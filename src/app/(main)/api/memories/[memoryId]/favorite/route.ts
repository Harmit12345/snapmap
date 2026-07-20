import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;

  try {
    const db = await getDb();
    const memory = await db.collection<any>('memories').findOne({ _id: memoryId, status: { $ne: 'deleted' } });
    if (!memory) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found', details: {} } },
        { status: 404 }
      );
    }

    try {
      await db.collection<any>('memory_favorites').insertOne({ memoryId, userId: DEMO_USER_ID, createdAt: new Date() });
      await db.collection<any>('memories').updateOne({ _id: memoryId }, { $inc: { favoriteCount: 1 } });
    } catch (err: any) {
      if (err.code === 11000) { // Duplicate key error
        return NextResponse.json(
          { error: { code: 'ALREADY_FAVORITED', message: 'Already favorited', details: {} } },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({
      data: { memoryId, favoritedAt: new Date().toISOString() }
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to add favorite', details: {} } },
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
  
  const result = await db.collection<any>('memory_favorites').deleteOne({ memoryId, userId: DEMO_USER_ID });
  if (result.deletedCount > 0) {
    await db.collection<any>('memories').updateOne({ _id: memoryId }, { $inc: { favoriteCount: -1 } });
  }

  return NextResponse.json({
    data: { memoryId, unfavoritedAt: new Date().toISOString() }
  });
}
