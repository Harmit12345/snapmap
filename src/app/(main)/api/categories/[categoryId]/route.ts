import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  
  try {
    const db = await getDb();
    
    const result = await db.collection<any>('categories').deleteOne({ id: categoryId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Category not found', details: {} } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { id: categoryId, status: 'deleted' } });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete category', details: {} } },
      { status: 500 }
    );
  }
}
