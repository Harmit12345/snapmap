import { NextRequest, NextResponse } from 'next/server';
import { createMemory } from '@/lib/store';

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

    // Validate body length
    if (body.body && body.body.length > 5000) {
      return NextResponse.json(
        { error: { code: 'BODY_TOO_LONG', message: 'body exceeds 5000 characters', details: {} } },
        { status: 400 }
      );
    }

    const memory = createMemory({
      title: body.title,
      body: body.body,
      lat: body.location.lat,
      lng: body.location.lng,
      locationName: body.locationName,
      address: body.address,
      visibility: body.visibility,
      memoryDate: body.memoryDate,
      categoryIds: body.categoryIds,
      primaryCategoryId: body.primaryCategoryId,
    });

    return NextResponse.json({ data: memory }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create memory', details: {} } },
      { status: 500 }
    );
  }
}
