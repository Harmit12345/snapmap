import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: { memoryId: string; commentId: string } }
) {
  try {
    const body = await request.json();
    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return NextResponse.json({ error: { message: 'Text is required' } }, { status: 400 });
    }

    const db = await getDb();
    
    // Verify the comment exists and belongs to the user
    const comment = await db.collection('memory_comments').findOne({ _id: params.commentId });
    if (!comment) {
      return NextResponse.json({ error: { message: 'Comment not found' } }, { status: 404 });
    }
    
    if (comment.userId !== DEMO_USER_ID) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 403 });
    }

    await db.collection('memory_comments').updateOne(
      { _id: params.commentId },
      { 
        $set: { 
          text: body.text.trim(),
          updatedAt: new Date().toISOString()
        } 
      }
    );

    const updatedComment = await db.collection('memory_comments').findOne({ _id: params.commentId });
    const mappedComment = { ...updatedComment, id: updatedComment?._id };

    return NextResponse.json({ data: mappedComment });
  } catch (err) {
    console.error('Failed to update comment:', err);
    return NextResponse.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { memoryId: string; commentId: string } }
) {
  try {
    const db = await getDb();
    
    // Verify the comment exists and belongs to the user
    const comment = await db.collection('memory_comments').findOne({ _id: params.commentId });
    if (!comment) {
      return NextResponse.json({ error: { message: 'Comment not found' } }, { status: 404 });
    }
    
    if (comment.userId !== DEMO_USER_ID) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 403 });
    }

    await db.collection('memory_comments').deleteOne({ _id: params.commentId });
    await db.collection('memories').updateOne(
      { _id: params.memoryId },
      { $inc: { commentCount: -1 } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete comment:', err);
    return NextResponse.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
