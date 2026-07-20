import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  // 1. Verify the Firebase ID token cryptographically
  let decoded;
  try {
    decoded = await verifyFirebaseToken(request.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request body
  let body: {
    uid?: string;
    phoneNumber?: string;
    email?: string;
    isSignUp?: boolean;
    username?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { phoneNumber, isSignUp, username } = body;

  // 3. Always use the UID from the verified token — never trust the client-supplied uid
  const uid = decoded.uid;
  const email = decoded.email ?? body.email ?? null;

  try {
    const db = await getDb();
    const usersCollection = db.collection('users');

    // 4. Look up existing profile
    const existingUser = await usersCollection.findOne({ firebaseUid: uid });

    if (existingUser) {
      // Update: link new identifiers if they aren't stored yet
      const updates: Record<string, unknown> = {};
      if (phoneNumber && !existingUser.phoneNumber)
        updates.phoneNumber = phoneNumber;
      if (email && !existingUser.email) updates.email = email;

      if (Object.keys(updates).length > 0) {
        await usersCollection.updateOne(
          { _id: existingUser._id },
          { $set: updates }
        );
      }

      const safeProfile = {
        ...existingUser,
        ...updates,
        _id: existingUser._id.toString(),
      };
      return NextResponse.json({ success: true, profile: safeProfile });
    }

    // 5. No existing profile — block if this is a sign-in attempt (not sign-up)
    if (!isSignUp) {
      return NextResponse.json(
        { error: 'No account found. Please sign up first!' },
        { status: 404 }
      );
    }

    // 6. Create a new profile for sign-up
    const defaultUsername =
      username ||
      (email
        ? email.split('@')[0]
        : phoneNumber
        ? `user_${phoneNumber.slice(-4)}`
        : `user_${uid.substring(0, 5)}`);

    const newUser = {
      firebaseUid: uid,
      email: email ?? null,
      phoneNumber: phoneNumber ?? null,
      username: defaultUsername,
      profile: {
        displayName: username || defaultUsername,
        bio: 'Hey there! I am using StoryShare.',
        photoUrl: '',
        privacySetting: 'public',
      },
      followersCount: 0,
      followingCount: 0,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    const safeNewProfile = { ...newUser, _id: result.insertedId.toString() };
    return NextResponse.json({ success: true, profile: safeNewProfile });
  } catch (error) {
    console.error('Error syncing profile:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
