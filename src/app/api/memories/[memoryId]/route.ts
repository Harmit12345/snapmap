import { NextRequest, NextResponse } from 'next/server';
import { getMemory, updateMemory, deleteMemory } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;
  const memory = getMemory(memoryId);

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
    const memory = updateMemory(memoryId, body);

    if (!memory) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'The requested memory does not exist.', details: {} } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: memory });
  } catch {
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
  const deleted = deleteMemory(memoryId);

  if (!deleted) {
    return NextResponse.json(
      { error: { code: 'MEMORY_NOT_FOUND', message: 'The requested memory does not exist.', details: {} } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { id: memoryId, status: 'deleted' } });
}
