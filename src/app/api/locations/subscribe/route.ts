import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

/**
 * GET /api/locations/subscribe?locationName=XYZ
 * Check if the current user is subscribed to a location.
 * Also checks hierarchically — if the user subscribed to the city "Junagadh",
 * a query for "Mullah Wada, Junagadh" will also show as followed.
 */
export async function GET(request: NextRequest) {
  try {
    const locationName = request.nextUrl.searchParams.get('locationName');
    if (!locationName) {
      return NextResponse.json({ isSubscribed: false });
    }

    const db = await getDb();
    const normalizedQuery = locationName.trim().toLowerCase();

    // Check exact match first
    const exactMatch = await db.collection<any>('location_subscriptions').findOne({
      userId: DEMO_USER_ID,
      locationName: { $regex: new RegExp(`^${escapeRegex(normalizedQuery)}$`, 'i') }
    });

    if (exactMatch) {
      return NextResponse.json({ isSubscribed: true });
    }

    // Check hierarchical match — user might have subscribed to the city
    // and this is a sub-area query, or vice versa
    const hierarchyMatch = await db.collection<any>('location_subscriptions').findOne({
      userId: DEMO_USER_ID,
      $or: [
        { city: { $regex: new RegExp(`^${escapeRegex(normalizedQuery)}$`, 'i') } },
        { state: { $regex: new RegExp(`^${escapeRegex(normalizedQuery)}$`, 'i') } },
        // Check if the queried name CONTAINS a subscribed city
        { locationName: { $regex: new RegExp(escapeRegex(normalizedQuery), 'i') } },
      ]
    });

    return NextResponse.json({ isSubscribed: !!hierarchyMatch });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ isSubscribed: false });
  }
}

/**
 * POST /api/locations/subscribe
 * Subscribe to a location. Stores the full hierarchy for smart matching.
 */
export async function POST(request: NextRequest) {
  try {
    const { locationName, city, state, country } = await request.json();
    
    if (!locationName) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'locationName is required', details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existing = await db.collection<any>('location_subscriptions').findOne({
      userId: DEMO_USER_ID,
      locationName
    });

    if (!existing) {
      await db.collection<any>('location_subscriptions').insertOne({
        userId: DEMO_USER_ID,
        locationName,
        city: city || null,
        state: state || null,
        country: country || null,
        createdAt: new Date()
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to subscribe to location', details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { locationName } = await request.json();
    
    if (!locationName) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'locationName is required', details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.collection<any>('location_subscriptions').deleteOne({
      userId: DEMO_USER_ID,
      locationName
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to unsubscribe from location', details: {} } },
      { status: 500 }
    );
  }
}

// Helper to escape special regex characters in user input
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
