import { NextRequest, NextResponse } from 'next/server';
import { confirmMedia } from '@/lib/store';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string; mediaId: string }> }
) {
  const { mediaId } = await params;

  const media = confirmMedia(mediaId);

  if (!media) {
    return NextResponse.json(
      { error: { code: 'ALREADY_CONFIRMED', message: 'Media is not in pending status', details: {} } },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: {
      mediaId: media.id,
      status: 'processing',
    }
  });
}
