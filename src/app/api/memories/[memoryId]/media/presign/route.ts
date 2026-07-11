import { NextRequest, NextResponse } from 'next/server';
import { createMediaRecord } from '@/lib/store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const { memoryId } = await params;

  try {
    const body = await request.json();

    // Validate type
    if (!['photo', 'video'].includes(body.type)) {
      return NextResponse.json(
        { error: { code: 'UNSUPPORTED_TYPE', message: 'type must be photo or video', details: {} } },
        { status: 400 }
      );
    }

    // File size limits
    const maxSize = body.type === 'photo' ? 20 * 1024 * 1024 : 500 * 1024 * 1024;
    if (body.fileSizeBytes > maxSize) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${body.type === 'photo' ? '20MB' : '500MB'} limit`, details: {} } },
        { status: 400 }
      );
    }

    const result = createMediaRecord(memoryId, {
      type: body.type,
      mimeType: body.mimeType || 'application/octet-stream',
      fileSizeBytes: body.fileSizeBytes || 0,
    });

    if (!result) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found', details: {} } },
        { status: 404 }
      );
    }

    // For demo: the upload URL points to our local upload endpoint
    const origin = request.nextUrl.origin;
    const uploadUrl = `${origin}/api/memories/${memoryId}/media/upload?mediaId=${result.mediaId}`;

    return NextResponse.json({
      data: {
        mediaId: result.mediaId,
        uploadUrl,
        storageKey: result.storageKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to presign', details: {} } },
      { status: 500 }
    );
  }
}
