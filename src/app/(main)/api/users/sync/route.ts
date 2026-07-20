import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function getUidFromToken(token: string) {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    const json = JSON.parse(decoded);
    return json.user_id;
  } catch (e) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const tokenUid = getUidFromToken(token);

    if (!tokenUid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { uid, phoneNumber, email, isSignUp, username } = body;

    // Verify token matches requested UID
    if (tokenUid !== uid) {
      return NextResponse.json({ error: 'Unauthorized UID mismatch' }, { status: 401 });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ firebaseUid: uid });

    if (existingUser) {
      // Update existing user with new info if provided (like linking phone to email)
      const updates: any = {};
      if (phoneNumber && !existingUser.phoneNumber) updates.phoneNumber = phoneNumber;
      if (email && !existingUser.email) updates.email = email;
      
      if (Object.keys(updates).length > 0) {
        await usersCollection.updateOne({ _id: existingUser._id }, { $set: updates });
        const safeProfile = { ...existingUser, ...updates, _id: existingUser._id.toString() };
        return NextResponse.json({ success: true, profile: safeProfile });
      }
      const safeProfile = { ...existingUser, _id: existingUser._id.toString() };
      return NextResponse.json({ success: true, profile: safeProfile });
    }

    // If no existing user, and they are trying to sign in, return error
    if (!isSignUp) {
      return NextResponse.json({ error: 'No account found. Sign up first!' }, { status: 404 });
    }

    // Create new user profile
    const newUser: any = {
      firebaseUid: uid,
      email: email || null,
      phoneNumber: phoneNumber || null,
      username: username || (email ? email.split('@')[0] : 'user_' + uid.substring(0, 5)),
      createdAt: new Date(),
    };

    await usersCollection.insertOne(newUser);
    const safeNewProfile = { ...newUser, _id: newUser._id?.toString() };
    return NextResponse.json({ success: true, profile: safeNewProfile });
  } catch (error) {
    console.error('Error syncing profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
