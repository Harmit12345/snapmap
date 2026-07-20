import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFullMemory, DEMO_USER_ID } from '@/lib/db-helpers';

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
        cursorId = decoded.i; // favorites cursor might not have 'i' in older versions, but we should support it
      } catch (e) {
        // ignore invalid cursor
      }
    }

    const query: any = { userId: DEMO_USER_ID };
    
    if (cursorDate) {
      if (cursorId) {
        query.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } }
        ];
      } else {
        query.createdAt = { $lt: cursorDate };
      }
    }

    const db = await getDb();
    const favsRows = await db.collection<any>('memory_favorites')
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();

    const memories = [];
    for (const row of favsRows) {
      const fullMem = await getFullMemory(row.memoryId);
      if (fullMem) memories.push(fullMem);
    }

    let nextCursor = null;
    let hasMore = false;

    if (favsRows.length > 0) {
      const last = favsRows[favsRows.length - 1];
      
      const moreQuery: any = { userId: DEMO_USER_ID };
      moreQuery.$or = [
        { createdAt: { $lt: last.createdAt } },
        { createdAt: last.createdAt, _id: { $lt: last._id } }
      ];
      
      const moreCount = await db.collection<any>('memory_favorites').countDocuments(moreQuery, { limit: 1 });
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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch favorites', details: {} } },
      { status: 500 }
    );
  }
}
