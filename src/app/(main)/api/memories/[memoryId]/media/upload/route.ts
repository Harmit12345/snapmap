import { NextRequest, NextResponse } from 'next/server';
import { storeUploadData } from '@/lib/store';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  void (await params).memoryId; // consume param

  try {
    const mediaId = request.nextUrl.searchParams.get('mediaId');
    if (!mediaId) {
      return NextResponse.json(
        { error: { code: 'MISSING_MEDIA_ID', message: 'mediaId query param required', details: {} } },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: 'No file provided', details: {} } },
        { status: 400 }
      );
    }

    // Convert to base64 data URL for in-memory storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const stored = storeUploadData(mediaId, dataUrl);
    if (!stored) {
      return NextResponse.json(
        { error: { code: 'MEDIA_NOT_FOUND', message: 'Media record not found', details: {} } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { mediaId, status: 'uploaded' } });
  } catch {
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: 'Upload failed', details: {} } },
      { status: 500 }
    );
  }
}
