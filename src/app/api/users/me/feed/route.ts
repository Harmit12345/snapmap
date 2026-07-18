import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFullMemory, DEMO_USER_ID } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

// Helper to escape special regex characters in user input
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  try {
    const cursorStr = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 50);

    let cursorDate: Date | null = null;
    let cursorId: string | null = null;

    if (cursorStr) {
      try {
        const decoded = JSON.parse(Buffer.from(cursorStr, 'base64').toString());
        cursorDate = new Date(decoded.c);
        cursorId = decoded.i;
      } catch (e) {
        // ignore invalid cursor
      }
    }

    const db = await getDb();
    
    // 1. Get all followed locations for this user
    const subscriptions = await db.collection<any>('location_subscriptions')
      .find({ userId: DEMO_USER_ID })
      .toArray();
      
    if (subscriptions.length === 0) {
      // If the user doesn't follow any locations, return empty
      return NextResponse.json({
        data: [],
        pagination: { nextCursor: null, hasMore: false }
      });
    }

    // 2. Build location matching conditions using BOTH locationName and city hierarchy
    // This ensures "Junagadh" subscription matches memories at "Mullah Wada" (same city)
    const locationConditions: any[] = [];
    
    for (const sub of subscriptions) {
      const name = sub.locationName;
      const city = sub.city;
      
      if (name) {
        // Escaped regex for safe matching
        locationConditions.push({ locationName: { $regex: new RegExp(escapeRegex(name), 'i') } });
        locationConditions.push({ address: { $regex: new RegExp(escapeRegex(name), 'i') } });
      }
      if (city) {
        // Match memories whose city field matches the subscription's city
        locationConditions.push({ city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') } });
      }
    }

    // 3. Build the complete query using $and to combine location filter + cursor
    // BUG FIX: Previously, cursor pagination OVERWROTE the $or clause, causing
    // all memories (not just followed ones) to appear after page 1
    const andClauses: any[] = [
      { status: { $ne: 'deleted' } },
      { $or: locationConditions }
    ];

    if (cursorDate && cursorId) {
      andClauses.push({
        $or: [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } }
        ]
      });
    }

    const query = { $and: andClauses };

    const memoriesRows = await db.collection<any>('memories')
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();

    const memories = [];
    for (const row of memoriesRows) {
      const fullMem = await getFullMemory(row._id);
      if (fullMem) memories.push(fullMem);
    }

    let nextCursor = null;
    let hasMore = false;

    if (memories.length > 0) {
      const last = memoriesRows[memoriesRows.length - 1];
      
      const moreAndClauses: any[] = [
        { status: { $ne: 'deleted' } },
        { $or: locationConditions },
        {
          $or: [
            { createdAt: { $lt: last.createdAt } },
            { createdAt: last.createdAt, _id: { $lt: last._id } }
          ]
        }
      ];
      
      const moreCount = await db.collection<any>('memories').countDocuments(
        { $and: moreAndClauses },
        { limit: 1 }
      );
      
      hasMore = moreCount > 0;
      
      if (hasMore) {
        nextCursor = Buffer.from(JSON.stringify({ c: last.createdAt, i: last._id })).toString('base64');
      }
    }

    return NextResponse.json({
      data: memories,
      pagination: { nextCursor, hasMore }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch feed', details: {} } },
      { status: 500 }
    );
  }
}
