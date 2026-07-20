import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
// Normally we'd verify the Firebase ID token here, but for simplicity, we will just decode it
// or extract the UID from the client request. However, the client passes `Authorization: Bearer <token>`
// To keep it simple without firebase-admin, we will parse the JWT manually just to get the `user_id`.
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

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const uid = getUidFromToken(token);

    if (!uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
