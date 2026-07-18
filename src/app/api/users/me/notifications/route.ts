import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    
    // Fetch notifications for the current user, sorted by most recent
    const notifications = await db.collection('notifications')
      .find({ userId: DEMO_USER_ID })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ data: notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications', details: {} } },
      { status: 500 }
    );
  }
}
