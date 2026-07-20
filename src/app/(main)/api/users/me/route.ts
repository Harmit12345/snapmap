import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyFirebaseToken(authHeader);
    const db = await getDb();
    const user = await db.collection('users').findOne({ firebaseUid: decoded.uid });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: { ...user, _id: user._id.toString() } });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyFirebaseToken(authHeader);
    const db = await getDb();
    
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const updates: any = {};
    if (body.username !== undefined) updates.username = body.username;
    
    // Updates for nested profile object
    if (body.displayName !== undefined) updates['profile.displayName'] = body.displayName;
    if (body.bio !== undefined) updates['profile.bio'] = body.bio;
    if (body.photoUrl !== undefined) updates['profile.photoUrl'] = body.photoUrl;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const result = await db.collection('users').findOneAndUpdate(
      { firebaseUid: decoded.uid },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: { ...result, _id: result._id.toString() } });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
