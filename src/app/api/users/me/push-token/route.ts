import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Token is required', details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // In a real app, this updates the user's profile with their device's FCM push token
    // For this boilerplate, we'll upsert into a dummy `user_push_tokens` collection
    await db.collection('user_push_tokens').updateOne(
      { userId: DEMO_USER_ID },
      { $set: { token, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save push token', details: {} } },
      { status: 500 }
    );
  }
}
