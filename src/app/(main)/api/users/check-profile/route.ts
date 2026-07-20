import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  // Verify the Firebase ID token cryptographically
  let decoded;
  try {
    decoded = await verifyFirebaseToken(request.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = decoded.uid;

  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ firebaseUid: uid });

    if (user) {
      return NextResponse.json({ exists: true, profile: user });
    }

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  } catch (error) {
    console.error('Error checking profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
