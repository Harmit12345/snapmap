import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier');

    if (!identifier) {
      return NextResponse.json({ exists: false }, { status: 400 });
    }

    const db = await getDb();

    const user = await db.collection('users').findOne({
      $or: [
        { email: identifier },
        { phoneNumber: identifier },
        { username: identifier },
      ],
    });

    // Return only whether the identifier exists — never leak the stored email or UID
    return NextResponse.json({ exists: !!user });
  } catch (error) {
    console.error('Error checking user existence:', error);
    return NextResponse.json(
      { exists: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
