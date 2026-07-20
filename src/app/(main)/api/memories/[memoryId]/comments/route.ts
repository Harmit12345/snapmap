import { NextRequest, NextResponse } from 'next/server';
import { getDb, genId } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { memoryId: string } }
) {
  try {
    const db = await getDb();
    const comments = await db.collection('memory_comments')
      .find({ memoryId: params.memoryId })
      .sort({ createdAt: -1 })
      .toArray();

    const mappedComments = comments.map(c => ({
      id: c._id,
      memoryId: c.memoryId,
      userId: c.userId,
      user: c.user,
      text: c.text,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return NextResponse.json({ data: mappedComments });
  } catch (err) {
    console.error('Failed to get comments:', err);
    return NextResponse.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { memoryId: string } }
) {
  try {
    const body = await request.json();
    if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
      return NextResponse.json({ error: { message: 'Text is required' } }, { status: 400 });
    }

    const db = await getDb();
    const commentId = genId();
    
    // In a real app we'd fetch the user's profile from the DB based on auth
    const mockUser = {
      id: DEMO_USER_ID,
      username: 'explorer',
      displayName: 'Alex Explorer',
      avatarUrl: ''
    };

    const newComment = {
      _id: commentId,
      memoryId: params.memoryId,
      userId: DEMO_USER_ID,
      user: mockUser,
      text: body.text.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('memory_comments').insertOne(newComment);
    await db.collection('memories').updateOne(
      { _id: params.memoryId },
      { $inc: { commentCount: 1 } }
    );

    return NextResponse.json({ data: { ...newComment, id: newComment._id } }, { status: 201 });
  } catch (err) {
    console.error('Failed to post comment:', err);
    return NextResponse.json({ error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
