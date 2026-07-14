import { NextRequest, NextResponse } from 'next/server';
import { supabase, getDb, genId } from '@/lib/db';
import { DEMO_USER_ID } from '@/lib/db-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;

  try {
    const body = await request.json();

    if (!['photo', 'video'].includes(body.type)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_TYPE', message: 'type must be photo or video', details: {} } },
        { status: 400 }
      );
    }

    const maxSize = body.type === 'photo' ? 20 * 1024 * 1024 : 500 * 1024 * 1024;
    if (body.fileSizeBytes > maxSize) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${body.type === 'photo' ? '20MB' : '500MB'} limit`, details: {} } },
        { status: 400 }
      );
    }

    const db = await getDb();
    const memory = await db.collection<any>('memories').findOne({ _id: memoryId, status: { $ne: 'deleted' } });
    if (!memory) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found', details: {} } },
        { status: 404 }
      );
    }

    const mediaCount = (memory.media || []).length;
    
    if (mediaCount >= 10) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_MEDIA', message: 'Maximum 10 media files allowed', details: {} } },
        { status: 400 }
      );
    }

    const mediaId = genId();
    const ext = body.filename ? body.filename.split('.').pop() : '';
    const storageKey = `${DEMO_USER_ID}/${memoryId}/${mediaId}${ext ? '.' + ext : ''}`;

    const newMedia = {
      id: mediaId,
      uploaderId: DEMO_USER_ID,
      type: body.type,
      status: 'pending',
      sortOrder: mediaCount,
      storageKey,
      mimeType: body.mimeType || 'application/octet-stream',
      fileSizeBytes: body.fileSizeBytes || 0,
      createdAt: new Date()
    };

    await db.collection<any>('memories').updateOne(
      { _id: memoryId },
      { $push: { media: newMedia } as any }
    );

    // Generate signed URL with Supabase
    const { data, error } = await supabase.storage.from('memories').createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new Error(error?.message || 'Failed to generate signed URL');
    }

    return NextResponse.json({
      data: {
        mediaId,
        uploadUrl: data.signedUrl,
        storageKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to presign', details: {} } },
      { status: 500 }
    );
  }
}
