import { NextRequest, NextResponse } from 'next/server';
import { addFavorite, removeFavorite } from '@/lib/store';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;
  const result = addFavorite(memoryId);

  if (!result.success && result.alreadyExists) {
    return NextResponse.json(
      { error: { code: 'ALREADY_FAVORITED', message: 'Already favorited', details: {} } },
      { status: 409 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found', details: {} } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { memoryId, favoritedAt: new Date().toISOString() }
  }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;
  removeFavorite(memoryId);

  return NextResponse.json({
    data: { memoryId, unfavoritedAt: new Date().toISOString() }
  });
}
