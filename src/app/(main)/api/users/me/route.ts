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
    
    if (body.privacySetting !== undefined) {
      if (!['public', 'private', 'followers'].includes(body.privacySetting)) {
        return NextResponse.json({ error: 'Invalid privacy setting. Allowed: public, private, followers' }, { status: 400 });
      }
      updates['profile.privacySetting'] = body.privacySetting;
    }

    const currentUser = await db.collection('users').findOne({ firebaseUid: decoded.uid });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (body.email !== undefined) {
      if (body.email) {
        const existingEmail = await db.collection('users').findOne({ email: body.email, _id: { $ne: currentUser._id } });
        if (existingEmail) {
          return NextResponse.json({ error: 'Email is already linked to another account.' }, { status: 400 });
        }
      }
      updates.email = body.email || null;
    }

    if (body.phoneNumber !== undefined) {
      if (body.phoneNumber) {
        const existingPhone = await db.collection('users').findOne({ phoneNumber: body.phoneNumber, _id: { $ne: currentUser._id } });
        if (existingPhone) {
          return NextResponse.json({ error: 'Phone number is already linked to another account.' }, { status: 400 });
        }
      }
      updates.phoneNumber = body.phoneNumber || null;
    }

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

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyFirebaseToken(authHeader);
    const db = await getDb();
    
    const userDoc = await db.collection('users').findOne({ firebaseUid: decoded.uid });
    if (!userDoc) {
      return NextResponse.json({ error: 'User profile not found in database.' }, { status: 404 });
    }

    // A. Delete follows associated with this user
    await db.collection('follows').deleteMany({
      $or: [{ followerId: userDoc._id }, { followeeId: userDoc._id }]
    });

    // B. Delete memories associated with this user
    await db.collection('memories').deleteMany({
      $or: [
        { userId: userDoc._id },
        { userId: userDoc._id.toString() },
        { userId: decoded.uid }
      ]
    });

    // C. Delete memory likes and favorites associated with this user
    await db.collection('memory_likes').deleteMany({
      $or: [{ userId: userDoc._id }, { userId: userDoc._id.toString() }]
    });

    await db.collection('memory_favorites').deleteMany({
      $or: [{ userId: userDoc._id }, { userId: userDoc._id.toString() }]
    });
    
    // D. Delete memory comments
    await db.collection('memory_comments').deleteMany({
      $or: [{ userId: userDoc._id }, { userId: userDoc._id.toString() }]
    });

    // E. Finally delete the user document itself
    await db.collection('users').deleteOne({ _id: userDoc._id });

    return NextResponse.json({ success: true, message: 'Account and related data successfully deleted from database.' });
  } catch (error) {
    console.error('Error in DELETE /api/users/me:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
