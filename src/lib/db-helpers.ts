import { getDb } from './db';
import type { Memory, MemoryCategory, MediaObject } from './types';

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// Helper to construct full memory response with joins
export async function getFullMemory(memoryId: string, requesterId: string = DEMO_USER_ID): Promise<Memory | null> {
  const db = await getDb();
  
  const mem = await db.collection<any>('memories').findOne({ _id: memoryId, status: { $ne: 'deleted' } });
  
  if (!mem) return null;

  const isLikedDoc = await db.collection<any>('memory_likes').findOne({ memoryId, userId: requesterId });
  const isFavoritedDoc = await db.collection<any>('memory_favorites').findOne({ memoryId, userId: requesterId });

  const isLocationFollowedDoc = mem.locationName ? await db.collection<any>('location_subscriptions').findOne({ locationName: mem.locationName, userId: requesterId }) : null;

  const bucketUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/memories`;
  
  const mappedMedia = (mem.media || []).map((m: any) => ({
    ...m,
    url: m.status === 'ready' ? `${bucketUrl}/${m.storageKey}` : null,
    thumbnailUrl: m.status === 'ready' && m.thumbnailKey ? `${bucketUrl}/${m.thumbnailKey}` : (m.status === 'ready' ? `${bucketUrl}/${m.storageKey}` : null)
  })) as MediaObject[];

  return {
    id: mem._id.toString(),
    userId: mem.userId,
    user: mem.user || {
      id: mem.userId,
      username: 'explorer',
      displayName: 'Alex Explorer',
      avatarUrl: ''
    },
    title: mem.title,
    body: mem.body,
    location: { lat: mem.location.coordinates[1], lng: mem.location.coordinates[0] },
    locationName: mem.locationName,
    address: mem.address,
    visibility: mem.visibility,
    status: mem.status,
    memoryDate: mem.memoryDate instanceof Date ? mem.memoryDate.toISOString() : mem.memoryDate,
    likeCount: mem.likeCount || 0,
    commentCount: mem.commentCount || 0,
    favoriteCount: mem.favoriteCount || 0,
    mediaCount: (mem.media || []).length,
    media: mappedMedia,
    categories: mem.categories || [],
    hashtags: mem.hashtags || [],
    city: mem.city || null,
    state: mem.state || null,
    country: mem.country || null,
    isFavorited: !!isFavoritedDoc,
    isLiked: !!isLikedDoc,
    isLocationFollowed: !!isLocationFollowedDoc,
    createdAt: mem.createdAt instanceof Date ? mem.createdAt.toISOString() : mem.createdAt,
    updatedAt: mem.updatedAt instanceof Date ? mem.updatedAt.toISOString() : mem.updatedAt,
  };
}
