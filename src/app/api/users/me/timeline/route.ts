import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFullMemory, DEMO_USER_ID } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try {
    const cursorStr = request.nextUrl.searchParams.get('cursor');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 50);
    const category = request.nextUrl.searchParams.get('category');
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');

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

    const query: any = { userId: DEMO_USER_ID };
    
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'deleted' };
    }

    if (category) {
      query['categories.slug'] = category;
    }

    const baseAndClauses: any[] = [];
    if (search) {
      const regex = new RegExp(search, 'i');
      baseAndClauses.push({
        $or: [
          { title: regex },
          { body: regex },
          { locationName: regex },
          { address: regex },
          { hashtags: regex }
        ]
      });
    }

    const currentQuery = { ...query };
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

    const db = await getDb();
    const memoriesRows = await db.collection<any>('memories')
      .find(currentQuery)
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
