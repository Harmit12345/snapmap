import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getFullMemory } from '@/lib/db-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;
  const memory = await getFullMemory(memoryId);

  if (!memory) {
    return NextResponse.json(
      { error: { code: 'MEMORY_NOT_FOUND', message: 'The requested memory does not exist.', details: {} } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: memory });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;

  try {
    const body = await request.json();
    const db = await getDb();

    const exists = await db.collection<any>('memories').findOne({ _id: memoryId, status: { $ne: 'deleted' } });
    if (!exists) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'The requested memory does not exist.', details: {} } },
        { status: 404 }
      );
    }

    const updateFields: any = { updatedAt: new Date() };
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.body !== undefined) updateFields.body = body.body;
    if (body.visibility !== undefined) updateFields.visibility = body.visibility;
    if (body.locationName !== undefined) updateFields.locationName = body.locationName;
    if (body.memoryDate !== undefined) updateFields.memoryDate = new Date(body.memoryDate);
    if (body.hashtags !== undefined) updateFields.hashtags = body.hashtags;

    if (body.categoryIds) {
      if (body.categoryIds.length > 0) {
        const cats = await db.collection<any>('categories').find({ id: { $in: body.categoryIds } }).toArray();
        const embeddedCategories = cats.map(c => ({
          id: c.id,
          slug: c.slug,
          displayName: c.displayName,
          icon: c.icon,
          color: c.color,
          isPrimary: c.id === body.primaryCategoryId,
          source: 'user',
          confidence: null
        }));
        updateFields.categories = embeddedCategories;
      } else {
        updateFields.categories = [];
      }
    }

    if (Object.keys(updateFields).length > 1) { // >1 because updatedAt is always present
      await db.collection<any>('memories').updateOne(
        { _id: memoryId },
        { $set: updateFields }
      );
    }

    const memory = await getFullMemory(memoryId);
    return NextResponse.json({ data: memory });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update memory', details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;
  const db = await getDb();
  
  const result = await db.collection<any>('memories').updateOne(
    { _id: memoryId, status: { $ne: 'deleted' } },
    { $set: { status: 'deleted', deletedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json(
      { error: { code: 'MEMORY_NOT_FOUND', message: 'The requested memory does not exist.', details: {} } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { id: memoryId, status: 'deleted' } });
}
