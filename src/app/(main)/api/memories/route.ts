import { NextRequest, NextResponse } from 'next/server';
import { getDb, genId } from '@/lib/db';
import { getFullMemory, DEMO_USER_ID } from '@/lib/db-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate location
    if (!body.location?.lat || !body.location?.lng) {
      return NextResponse.json(
        { error: { code: 'INVALID_LOCATION', message: 'lat and lng are required', details: {} } },
        { status: 400 }
      );
    }

    if (body.location.lat < -90 || body.location.lat > 90 ||
        body.location.lng < -180 || body.location.lng > 180) {
      return NextResponse.json(
        { error: { code: 'INVALID_LOCATION', message: 'lat/lng out of range', details: {} } },
        { status: 400 }
      );
    }

    if (body.body && body.body.length > 5000) {
      return NextResponse.json(
        { error: { code: 'BODY_TOO_LONG', message: 'body exceeds 5000 characters', details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();

    let embeddedCategories: any[] = [];
    if (body.categoryIds && body.categoryIds.length > 0) {
      const cats = await db.collection<any>('categories').find({ id: { $in: body.categoryIds } }).toArray();
      embeddedCategories = cats.map(c => ({
        id: c.id,
        slug: c.slug,
        displayName: c.displayName,
        icon: c.icon,
        color: c.color,
        isPrimary: c.id === body.primaryCategoryId,
        source: 'user',
        confidence: null
      }));
    }

    const memoryId = genId();

    const newMemory = {
      _id: memoryId,
      userId: DEMO_USER_ID,
      title: body.title || null,
      body: body.body || null,
      location: {
        type: 'Point',
        coordinates: [body.location.lng, body.location.lat]
      },
      locationName: body.locationName || null,
      address: body.address || null,
      visibility: body.visibility || 'public',
      status: 'published',
      memoryDate: body.memoryDate ? new Date(body.memoryDate) : new Date(),
      likeCount: 0,
      commentCount: 0,
      favoriteCount: 0,
      mediaCount: 0,
      media: [],
      categories: embeddedCategories,
      hashtags: body.hashtags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection<any>('memories').insertOne(newMemory);

    const memory = await getFullMemory(memoryId);

    return NextResponse.json({ data: memory }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create memory', details: {} } },
      { status: 500 }
    );
  }
}
