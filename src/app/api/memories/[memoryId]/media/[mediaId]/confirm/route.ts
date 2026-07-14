import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ memoryId: string; mediaId: string }> }
) {
  const { memoryId, mediaId } = await params;

  try {
    const db = await getDb();
    const memory = await db.collection<any>('memories').findOne({ _id: memoryId, "media.id": mediaId });
    if (!memory) {
      return NextResponse.json(
        { error: { code: 'MEMORY_NOT_FOUND', message: 'Memory or media not found', details: {} } },
        { status: 404 }
      );
    }

    const mediaItem = memory.media.find((m: any) => m.id === mediaId);
    if (mediaItem.status !== 'pending') {
      return NextResponse.json(
        { error: { code: 'ALREADY_CONFIRMED', message: 'Media is not in pending status', details: {} } },
        { status: 400 }
      );
    }

    await db.collection<any>('memories').updateOne(
      { _id: memoryId, "media.id": mediaId },
      { $set: { "media.$.status": "processing", "media.$.updatedAt": new Date() } }
    );

    // Simulate async worker processing
    setTimeout(async () => {
      try {
        await db.collection<any>('memories').updateOne(
          { _id: memoryId, "media.id": mediaId },
          { $set: { 
              "media.$.status": "ready", 
              "media.$.width": 1920, 
              "media.$.height": 1080, 
              "media.$.updatedAt": new Date() 
            } 
          }
        );

        const memUpdated = await db.collection<any>('memories').findOne({ _id: memoryId });
        if (memUpdated) {
          const readyCount = (memUpdated.media || []).filter((m: any) => m.status === 'ready').length;
          await db.collection<any>('memories').updateOne(
            { _id: memoryId },
            { $set: { mediaCount: readyCount } }
          );
        }
      } catch (err) {
        console.error('Simulated worker failed:', err);
      }
    }, 2000);

    return NextResponse.json({
      data: {
        mediaId: mediaId,
        status: 'processing',
      }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm media', details: {} } },
      { status: 500 }
    );
  }
}
