import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    
    let filter: any = { userId: DEMO_USER_ID };

    if (body.notificationId) {
      // Handle both ObjectId and string _id formats safely
      try {
        filter._id = new ObjectId(body.notificationId);
      } catch {
        // If it's not a valid ObjectId string, try matching as a raw string
        filter._id = body.notificationId;
      }
    } else {
      // Mark all as read
      filter.read = false;
    }

    const result = await db.collection('notifications').updateMany(
      filter,
      { $set: { read: true } }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update notifications', details: {} } },
      { status: 500 }
    );
  }
}
