import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const db = await getDb();
    const categories = await db.collection<any>('categories').find({ isActive: true }).sort({ sortOrder: 1 }).toArray();

    const mappedCategories = categories.map(c => ({
      id: c.id || c._id.toString(),
      slug: c.slug,
      displayName: c.displayName,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      isActive: c.isActive
    }));

    return NextResponse.json({ data: mappedCategories });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch categories', details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName, icon, color } = body;

    if (!displayName || !icon || !color) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Missing required fields', details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();
    
    // Get highest sort order
    const lastCat = await db.collection<any>('categories').find().sort({ sortOrder: -1 }).limit(1).toArray();
    const nextSortOrder = lastCat.length > 0 ? lastCat[0].sortOrder + 1 : 1;

    // Generate slug from display name
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const id = `cat-${Date.now()}`;

    const newCategory = {
      id,
      slug,
      displayName,
      icon,
      color,
      sortOrder: nextSortOrder,
      isActive: true,
      createdAt: new Date()
    };

    await db.collection<any>('categories').insertOne(newCategory);

    return NextResponse.json({ data: newCategory });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create category', details: {} } },
      { status: 500 }
    );
  }
}
