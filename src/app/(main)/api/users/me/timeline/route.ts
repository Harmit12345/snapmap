import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFullMemory, DEMO_USER_ID } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cursorStr = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 50);
    const category = request.nextUrl.searchParams.get('category');
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');
    
    // Map & Discovery parameters
    const lat = request.nextUrl.searchParams.get('lat');
    const lng = request.nextUrl.searchParams.get('lng');
    const radius = request.nextUrl.searchParams.get('radius'); // in meters, default 5000

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

    const query: any = {};
    
    if (lat && lng) {
      // Discover nearby: global public memories
      query.visibility = 'public';
      query.status = status || 'published';
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius ? parseInt(radius, 10) : 5000
        }
      };
    } else {
      // Personal timeline
      query.userId = DEMO_USER_ID;
      if (status) {
        query.status = status;
      } else {
        query.status = { $ne: 'deleted' };
      }
    }

    if (category) {
      query['categories.slug'] = category;
    }

    const baseAndClauses: any[] = [];
    if (search) {
      // Escape special regex characters to prevent ReDoS and injection
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      baseAndClauses.push({
        $or: [
          { title: regex },
          { body: regex },
          { locationName: regex },
          { address: regex },
          { city: regex },
          { hashtags: regex }
        ]
      });
    }

    const currentQuery = { ...query };
    
    // Note: $near sorting overrides other sorts natively. We'll rely on it if using $near
    // We shouldn't use cursor with $near in MongoDB because $near inherently sorts by distance.
    if (!lat || !lng) {
      if (cursorDate && cursorId) {
        currentQuery.$and = [
          ...baseAndClauses,
          {
            $or: [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: cursorId } }
            ]
          }
        ];
      } else if (baseAndClauses.length > 0) {
        currentQuery.$and = baseAndClauses;
      }
    } else if (baseAndClauses.length > 0) {
        currentQuery.$and = baseAndClauses;
    }

    const db = await getDb();
    
    const findCursor = db.collection<any>('memories').find(currentQuery);
    
    if (!lat || !lng) {
      findCursor.sort({ createdAt: -1, _id: -1 });
    }
    
    const memoriesRows = await findCursor.limit(limit).toArray();

    const memories = [];
    for (const row of memoriesRows) {
      const fullMem = await getFullMemory(row._id);
      if (fullMem) memories.push(fullMem);
    }

    let nextCursor = null;
    let hasMore = false;

    // Pagination for $near can be complex, often involves skipping or dist offsets. 
    // For MVP, we'll implement simple skip or no pagination for near queries, or standard cursor for timeline
    if (memories.length > 0 && (!lat || !lng)) {
      const last = memoriesRows[memoriesRows.length - 1];
      
      const moreQuery = { ...query };
      moreQuery.$and = [
        ...baseAndClauses,
        {
          $or: [
            { createdAt: { $lt: last.createdAt } },
            { createdAt: last.createdAt, _id: { $lt: last._id } }
          ]
        }
      ];
      
      const moreCount = await db.collection<any>('memories').countDocuments(moreQuery, { limit: 1 });
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch timeline', details: {} } },
      { status: 500 }
    );
  }
}
