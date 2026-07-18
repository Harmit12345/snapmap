import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID, getFullMemory } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ locationName: string }> }) {
  try {
    const db = await getDb();
    const resolvedParams = await params;
    const locationName = decodeURIComponent(resolvedParams.locationName);

    // 1. Get total memory count & contributors at this location (for public memories)
    const pipeline = [
      { $match: { locationName, status: 'published', visibility: 'public' } },
      { 
        $group: {
          _id: null,
          memoryCount: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" }
        }
      }
    ];
    const statsResult = await db.collection<any>('memories').aggregate(pipeline).toArray();
    const memoryCount = statsResult[0]?.memoryCount || 0;
    const contributorCount = statsResult[0]?.uniqueUsers?.length || 0;

    // 2. Get subscriber count
    const subscriberCount = await db.collection<any>('location_subscriptions').countDocuments({ locationName });

    // 3. Check if current user is subscribed
    const isSubscribed = await db.collection<any>('location_subscriptions').findOne({ locationName, userId: DEMO_USER_ID });

    // 4. Get recent public memories for this location
    const recentMemoriesRows = await db.collection<any>('memories')
      .find({ locationName, status: 'published', visibility: 'public' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const memories = [];
    for (const row of recentMemoriesRows) {
      const fullMem = await getFullMemory(row._id);
      if (fullMem) memories.push(fullMem);
    }

    return NextResponse.json({
      locationName,
      stats: {
        memoryCount,
        contributorCount,
        subscriberCount
      },
      isSubscribed: !!isSubscribed,
      memories
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch location details', details: {} } },
      { status: 500 }
    );
  }
}
