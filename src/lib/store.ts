// ============================================================
// In-Memory Store — Simulates PostgreSQL + PostGIS for Demo
// Pre-seeded with categories and sample memories
// ============================================================

import type {
  Memory,
  MediaObject,
  Category,
  MemoryCategory,
  UserSummary,
  MediaStatus,
} from './types';

// ---- UUID helper ----
let counter = 0;
export function genId(): string {
  counter++;
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rnd}-${counter.toString().padStart(4, '0')}`;
}

// ---- Current demo user ----
export const DEMO_USER: UserSummary = {
  id: 'user-demo-001',
  username: 'explorer',
  displayName: 'Alex Explorer',
  avatarUrl: '',
};

// ---- Categories (matches schema.sql seed) ----
export const CATEGORIES: Category[] = [
  { id: 'cat-01', slug: 'food-drink',   displayName: 'Food & Drink',  icon: '🍜', color: '#FF6B35', sortOrder: 1, isActive: true },
  { id: 'cat-02', slug: 'nature',       displayName: 'Nature',        icon: '🌿', color: '#2D6A4F', sortOrder: 2, isActive: true },
  { id: 'cat-03', slug: 'nightlife',    displayName: 'Nightlife',     icon: '🌙', color: '#7B2D8B', sortOrder: 3, isActive: true },
  { id: 'cat-04', slug: 'hidden-gem',   displayName: 'Hidden Gem',    icon: '💎', color: '#0077B6', sortOrder: 4, isActive: true },
  { id: 'cat-05', slug: 'culture',      displayName: 'Culture',       icon: '🎭', color: '#E63946', sortOrder: 5, isActive: true },
  { id: 'cat-06', slug: 'adventure',    displayName: 'Adventure',     icon: '🏔️', color: '#F4A261', sortOrder: 6, isActive: true },
  { id: 'cat-07', slug: 'shopping',     displayName: 'Shopping',      icon: '🛍️', color: '#E76F51', sortOrder: 7, isActive: true },
  { id: 'cat-08', slug: 'relaxation',   displayName: 'Relaxation',    icon: '🧘', color: '#83C5BE', sortOrder: 8, isActive: true },
  { id: 'cat-09', slug: 'photography',  displayName: 'Photography',   icon: '📸', color: '#264653', sortOrder: 9, isActive: true },
  { id: 'cat-10', slug: 'local-tip',    displayName: 'Local Tip',     icon: '📌', color: '#E9C46A', sortOrder: 10, isActive: true },
];

function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id);
}

// ---- In-memory tables ----

interface StoredMemory {
  id: string;
  userId: string;
  title: string | null;
  body: string | null;
  lat: number;
  lng: number;
  locationName: string | null;
  address: string | null;
  visibility: 'public' | 'friends' | 'private';
  status: 'draft' | 'published' | 'archived' | 'deleted';
  memoryDate: string;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface StoredMedia {
  id: string;
  memoryId: string;
  uploaderId: string;
  type: 'photo' | 'video';
  status: MediaStatus;
  sortOrder: number;
  storageKey: string;
  thumbnailKey: string | null;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  blurhash: string | null;
  dataUrl: string | null; // for demo: stores base64 data URL
  createdAt: string;
  updatedAt: string;
}

interface StoredMemoryCategory {
  id: string;
  memoryId: string;
  categoryId: string;
  isPrimary: boolean;
  source: 'user' | 'ai';
  confidence: number | null;
}

interface StoredLike {
  id: string;
  memoryId: string;
  userId: string;
  createdAt: string;
}

interface StoredFavorite {
  id: string;
  memoryId: string;
  userId: string;
  createdAt: string;
}

// ---- Storage maps ----
const memories: Map<string, StoredMemory> = new Map();
const mediaItems: Map<string, StoredMedia> = new Map();
const memoryCategories: StoredMemoryCategory[] = [];
const likes: StoredLike[] = [];
const favorites: StoredFavorite[] = [];

// Buffer for uploaded files (mediaId → base64 dataUrl)
const uploadBuffers: Map<string, string> = new Map();

// ---- Seed data ----

function seedData() {
  const now = new Date();
  const seedMemories: Array<{
    id: string;
    title: string;
    body: string;
    lat: number;
    lng: number;
    locationName: string;
    address: string;
    categoryIds: string[];
    primaryCategoryId: string;
    daysAgo: number;
    likes: number;
  }> = [
    {
      id: 'mem-seed-01',
      title: 'Best ramen in Shibuya',
      body: 'Found this tiny shop down an alley near the station. The tonkotsu broth is unreal — they simmer it for 18 hours. The noodles are perfectly firm and the chashu melts in your mouth. Definitely coming back every time I\'m in Tokyo.',
      lat: 35.6595, lng: 139.7004,
      locationName: 'Fuunji', address: '2-14-3 Yoyogi, Shibuya, Tokyo',
      categoryIds: ['cat-01'], primaryCategoryId: 'cat-01',
      daysAgo: 0, likes: 24,
    },
    {
      id: 'mem-seed-02',
      title: 'Sunrise at Central Park',
      body: 'Got up at 5am and it was absolutely worth it. The way the golden light filters through the trees and reflects off the lake is magical. Almost no one around — just me, a few joggers, and the ducks.',
      lat: 40.7829, lng: -73.9654,
      locationName: 'Central Park', address: 'Central Park, New York, NY',
      categoryIds: ['cat-02', 'cat-09'], primaryCategoryId: 'cat-02',
      daysAgo: 1, likes: 42,
    },
    {
      id: 'mem-seed-03',
      title: 'Secret rooftop bar',
      body: 'No sign, no menu, just vibes. You enter through what looks like a phone booth in the hotel lobby. The cocktails are crafted based on your mood — told the bartender I felt adventurous and got something with smoked mezcal and passion fruit.',
      lat: 51.5074, lng: -0.1278,
      locationName: 'The Whisper', address: 'Shoreditch, London',
      categoryIds: ['cat-03', 'cat-04'], primaryCategoryId: 'cat-03',
      daysAgo: 2, likes: 67,
    },
    {
      id: 'mem-seed-04',
      title: 'Hidden waterfall trail',
      body: 'This trail isn\'t on Google Maps. A local farmer showed us the path behind his property. After a 30-minute hike through bamboo forest, you reach a 20-meter waterfall with a natural swimming pool at the base. Pure paradise.',
      lat: -8.4095, lng: 115.1889,
      locationName: 'Secret Waterfall', address: 'Munduk, Bali, Indonesia',
      categoryIds: ['cat-04', 'cat-06', 'cat-02'], primaryCategoryId: 'cat-04',
      daysAgo: 3, likes: 89,
    },
    {
      id: 'mem-seed-05',
      title: 'Street art tour in Wynwood',
      body: 'Every wall is a canvas here. Spent three hours just wandering and photographing murals. The colors, the scale, the creativity — it\'s like walking through a living museum. Met two of the artists working on a new piece.',
      lat: 25.8041, lng: -80.1998,
      locationName: 'Wynwood Walls', address: 'Wynwood, Miami, FL',
      categoryIds: ['cat-05', 'cat-09'], primaryCategoryId: 'cat-05',
      daysAgo: 5, likes: 31,
    },
    {
      id: 'mem-seed-06',
      title: 'Paragliding over the Alps',
      body: 'Absolutely terrifying for the first 10 seconds, then pure euphoria. Flying over snow-capped peaks at 2500m with nothing but the wind and an incredible view. The pilot let me steer for a bit — total freedom.',
      lat: 47.2692, lng: 11.4041,
      locationName: 'Nordkette', address: 'Innsbruck, Austria',
      categoryIds: ['cat-06'], primaryCategoryId: 'cat-06',
      daysAgo: 7, likes: 156,
    },
    {
      id: 'mem-seed-07',
      title: 'Vintage market find',
      body: 'Found a 1960s Japanese mechanical watch for €40. The vendor had no idea what it was worth. Also picked up some handmade ceramics and a first-edition paperback. Love the thrill of the hunt.',
      lat: 48.8566, lng: 2.3522,
      locationName: 'Marché aux Puces', address: 'Saint-Ouen, Paris',
      categoryIds: ['cat-07', 'cat-04'], primaryCategoryId: 'cat-07',
      daysAgo: 10, likes: 18,
    },
    {
      id: 'mem-seed-08',
      title: 'Onsen with a view',
      body: 'Open-air hot spring overlooking a misty valley. 42°C water, cool mountain air on your face, and nothing but silence and cedar trees. This is what true relaxation feels like. Stayed for two hours.',
      lat: 35.2339, lng: 139.1067,
      locationName: 'Hakone Onsen', address: 'Hakone, Kanagawa, Japan',
      categoryIds: ['cat-08', 'cat-02'], primaryCategoryId: 'cat-08',
      daysAgo: 12, likes: 73,
    },
  ];

  for (const sm of seedMemories) {
    const createdAt = new Date(now.getTime() - sm.daysAgo * 86400000).toISOString();

    memories.set(sm.id, {
      id: sm.id,
      userId: DEMO_USER.id,
      title: sm.title,
      body: sm.body,
      lat: sm.lat,
      lng: sm.lng,
      locationName: sm.locationName,
      address: sm.address,
      visibility: 'public',
      status: 'published',
      memoryDate: createdAt,
      likeCount: sm.likes,
      commentCount: Math.floor(Math.random() * 10),
      favoriteCount: Math.floor(Math.random() * 20),
      mediaCount: 0,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });

    for (const catId of sm.categoryIds) {
      memoryCategories.push({
        id: genId(),
        memoryId: sm.id,
        categoryId: catId,
        isPrimary: catId === sm.primaryCategoryId,
        source: 'user',
        confidence: null,
      });
    }
  }
}

seedData();

// ---- Public API ----

export function getAllCategories(): Category[] {
  return CATEGORIES.filter(c => c.isActive);
}

function buildMediaObject(m: StoredMedia): MediaObject {
  return {
    id: m.id,
    type: m.type,
    status: m.status,
    sortOrder: m.sortOrder,
    url: m.status === 'ready' ? (m.dataUrl || `/api/media/${m.id}/file`) : null,
    thumbnailUrl: m.status === 'ready' ? (m.dataUrl || `/api/media/${m.id}/file`) : null,
    blurhash: m.blurhash,
    width: m.width,
    height: m.height,
    durationSeconds: m.durationSeconds,
    mimeType: m.mimeType,
    fileSizeBytes: m.fileSizeBytes,
  };
}

function getMemoryCategories(memoryId: string): MemoryCategory[] {
  return memoryCategories
    .filter(mc => mc.memoryId === memoryId)
    .map(mc => {
      const cat = getCategoryById(mc.categoryId);
      if (!cat) return null;
      return {
        id: cat.id,
        slug: cat.slug,
        displayName: cat.displayName,
        icon: cat.icon,
        color: cat.color,
        isPrimary: mc.isPrimary,
        source: mc.source,
        confidence: mc.confidence,
      };
    })
    .filter((c): c is MemoryCategory => c !== null);
}

function getMediaForMemory(memoryId: string): MediaObject[] {
  return Array.from(mediaItems.values())
    .filter(m => m.memoryId === memoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(buildMediaObject);
}

export function buildMemoryResponse(stored: StoredMemory, requesterId?: string): Memory {
  const uid = requesterId || DEMO_USER.id;
  return {
    id: stored.id,
    userId: stored.userId,
    user: DEMO_USER,
    title: stored.title,
    body: stored.body,
    location: { lat: stored.lat, lng: stored.lng },
    locationName: stored.locationName,
    address: stored.address,
    visibility: stored.visibility,
    status: stored.status,
    memoryDate: stored.memoryDate,
    likeCount: stored.likeCount,
    commentCount: stored.commentCount,
    favoriteCount: stored.favoriteCount,
    mediaCount: stored.mediaCount,
    media: getMediaForMemory(stored.id),
    categories: getMemoryCategories(stored.id),
    isFavorited: favorites.some(f => f.memoryId === stored.id && f.userId === uid),
    isLiked: likes.some(l => l.memoryId === stored.id && l.userId === uid),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

// ---- Memory CRUD ----

export function createMemory(data: {
  title?: string;
  body?: string;
  lat: number;
  lng: number;
  locationName?: string;
  address?: string;
  visibility?: 'public' | 'friends' | 'private';
  memoryDate?: string;
  categoryIds?: string[];
  primaryCategoryId?: string;
}): Memory {
  const id = genId();
  const now = new Date().toISOString();

  const stored: StoredMemory = {
    id,
    userId: DEMO_USER.id,
    title: data.title || null,
    body: data.body || null,
    lat: data.lat,
    lng: data.lng,
    locationName: data.locationName || null,
    address: data.address || null,
    visibility: data.visibility || 'public',
    status: 'published',
    memoryDate: data.memoryDate || now,
    likeCount: 0,
    commentCount: 0,
    favoriteCount: 0,
    mediaCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  memories.set(id, stored);

  // Add categories
  if (data.categoryIds) {
    for (const catId of data.categoryIds) {
      memoryCategories.push({
        id: genId(),
        memoryId: id,
        categoryId: catId,
        isPrimary: catId === data.primaryCategoryId,
        source: 'user',
        confidence: null,
      });
    }
  }

  return buildMemoryResponse(stored);
}

export function getMemory(id: string): Memory | null {
  const stored = memories.get(id);
  if (!stored || stored.status === 'deleted') return null;
  return buildMemoryResponse(stored);
}

export function updateMemory(id: string, data: {
  title?: string;
  body?: string;
  visibility?: 'public' | 'friends' | 'private';
  locationName?: string;
  memoryDate?: string;
  categoryIds?: string[];
  primaryCategoryId?: string;
}): Memory | null {
  const stored = memories.get(id);
  if (!stored || stored.status === 'deleted') return null;

  if (data.title !== undefined) stored.title = data.title;
  if (data.body !== undefined) stored.body = data.body;
  if (data.visibility !== undefined) stored.visibility = data.visibility;
  if (data.locationName !== undefined) stored.locationName = data.locationName;
  if (data.memoryDate !== undefined) stored.memoryDate = data.memoryDate;
  stored.updatedAt = new Date().toISOString();

  // Replace categories if provided
  if (data.categoryIds) {
    // Remove old
    const toRemove = memoryCategories
      .map((mc, i) => mc.memoryId === id ? i : -1)
      .filter(i => i >= 0)
      .reverse();
    for (const i of toRemove) memoryCategories.splice(i, 1);

    // Add new
    for (const catId of data.categoryIds) {
      memoryCategories.push({
        id: genId(),
        memoryId: id,
        categoryId: catId,
        isPrimary: catId === data.primaryCategoryId,
        source: 'user',
        confidence: null,
      });
    }
  }

  return buildMemoryResponse(stored);
}

export function deleteMemory(id: string): boolean {
  const stored = memories.get(id);
  if (!stored) return false;
  stored.status = 'deleted';
  stored.deletedAt = new Date().toISOString();
  return true;
}

// ---- Media ----

export function createMediaRecord(memoryId: string, data: {
  type: 'photo' | 'video';
  mimeType: string;
  fileSizeBytes: number;
}): { mediaId: string; storageKey: string } | null {
  const mem = memories.get(memoryId);
  if (!mem || mem.status === 'deleted') return null;

  const mediaId = genId();
  const storageKey = `uploads/${DEMO_USER.id}/${memoryId}/${mediaId}`;
  const existingMedia = Array.from(mediaItems.values()).filter(m => m.memoryId === memoryId);

  const stored: StoredMedia = {
    id: mediaId,
    memoryId,
    uploaderId: DEMO_USER.id,
    type: data.type,
    status: 'pending',
    sortOrder: existingMedia.length,
    storageKey,
    thumbnailKey: null,
    mimeType: data.mimeType,
    fileSizeBytes: data.fileSizeBytes,
    width: null,
    height: null,
    durationSeconds: null,
    blurhash: null,
    dataUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mediaItems.set(mediaId, stored);
  return { mediaId, storageKey };
}

export function storeUploadData(mediaId: string, dataUrl: string): boolean {
  const media = mediaItems.get(mediaId);
  if (!media) return false;
  media.dataUrl = dataUrl;
  uploadBuffers.set(mediaId, dataUrl);
  return true;
}

export function confirmMedia(mediaId: string): StoredMedia | null {
  const media = mediaItems.get(mediaId);
  if (!media || media.status !== 'pending') return null;
  media.status = 'processing';
  media.updatedAt = new Date().toISOString();

  // Simulate async processing (2 second delay)
  setTimeout(() => {
    media.status = 'ready';
    media.width = 1920;
    media.height = 1080;
    media.updatedAt = new Date().toISOString();

    // Recover data url from buffer
    const buf = uploadBuffers.get(mediaId);
    if (buf) {
      media.dataUrl = buf;
    }

    // Update memory media count
    const mem = memories.get(media.memoryId);
    if (mem) {
      const count = Array.from(mediaItems.values())
        .filter(m => m.memoryId === media.memoryId && m.status === 'ready').length;
      mem.mediaCount = count;
    }
  }, 2000);

  return media;
}

export function getMediaById(mediaId: string): StoredMedia | null {
  return mediaItems.get(mediaId) || null;
}

// ---- Timeline ----

export function getTimeline(params: {
  cursor?: string;
  limit?: number;
  category?: string;
  status?: string;
}): { data: Memory[]; pagination: { nextCursor: string | null; hasMore: boolean } } {
  const limit = Math.min(params.limit || 20, 50);

  let items = Array.from(memories.values())
    .filter(m => m.userId === DEMO_USER.id && m.status !== 'deleted');

  if (params.status) {
    items = items.filter(m => m.status === params.status);
  }

  if (params.category) {
    const catSlug = params.category;
    items = items.filter(m => {
      const cats = memoryCategories.filter(mc => mc.memoryId === m.id);
      return cats.some(mc => {
        const cat = getCategoryById(mc.categoryId);
        return cat && cat.slug === catSlug;
      });
    });
  }

  // Sort by createdAt DESC
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Apply cursor
  if (params.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(params.cursor, 'base64').toString());
      const cursorDate = new Date(decoded.c).getTime();
      const cursorId = decoded.i;
      items = items.filter(m => {
        const t = new Date(m.createdAt).getTime();
        return t < cursorDate || (t === cursorDate && m.id < cursorId);
      });
    } catch {
      // invalid cursor, ignore
    }
  }

  const page = items.slice(0, limit);
  const hasMore = items.length > limit;

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ c: last.createdAt, i: last.id })).toString('base64');
  }

  return {
    data: page.map(m => buildMemoryResponse(m)),
    pagination: { nextCursor, hasMore },
  };
}

// ---- Favorites ----

export function addFavorite(memoryId: string): { success: boolean; alreadyExists: boolean } {
  const mem = memories.get(memoryId);
  if (!mem || mem.status === 'deleted') return { success: false, alreadyExists: false };

  const existing = favorites.find(f => f.memoryId === memoryId && f.userId === DEMO_USER.id);
  if (existing) return { success: false, alreadyExists: true };

  favorites.push({
    id: genId(),
    memoryId,
    userId: DEMO_USER.id,
    createdAt: new Date().toISOString(),
  });

  mem.favoriteCount++;
  return { success: true, alreadyExists: false };
}

export function removeFavorite(memoryId: string): boolean {
  const idx = favorites.findIndex(f => f.memoryId === memoryId && f.userId === DEMO_USER.id);
  if (idx < 0) return false;
  favorites.splice(idx, 1);

  const mem = memories.get(memoryId);
  if (mem) mem.favoriteCount = Math.max(0, mem.favoriteCount - 1);
  return true;
}

export function getFavorites(params: {
  cursor?: string;
  limit?: number;
}): { data: Memory[]; pagination: { nextCursor: string | null; hasMore: boolean } } {
  const limit = Math.min(params.limit || 20, 50);

  let favs = favorites
    .filter(f => f.userId === DEMO_USER.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (params.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(params.cursor, 'base64').toString());
      const cursorDate = new Date(decoded.c).getTime();
      favs = favs.filter(f => new Date(f.createdAt).getTime() < cursorDate);
    } catch {
      // invalid cursor
    }
  }

  const page = favs.slice(0, limit);
  const hasMore = favs.length > limit;

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ c: last.createdAt })).toString('base64');
  }

  const data = page
    .map(f => {
      const mem = memories.get(f.memoryId);
      if (!mem || mem.status === 'deleted') return null;
      return buildMemoryResponse(mem);
    })
    .filter((m): m is Memory => m !== null);

  return { data, pagination: { nextCursor, hasMore } };
}

// ---- Likes ----

export function addLike(memoryId: string): { success: boolean; alreadyExists: boolean; likeCount: number } {
  const mem = memories.get(memoryId);
  if (!mem || mem.status === 'deleted') return { success: false, alreadyExists: false, likeCount: 0 };

  const existing = likes.find(l => l.memoryId === memoryId && l.userId === DEMO_USER.id);
  if (existing) return { success: false, alreadyExists: true, likeCount: mem.likeCount };

  likes.push({
    id: genId(),
    memoryId,
    userId: DEMO_USER.id,
    createdAt: new Date().toISOString(),
  });

  mem.likeCount++;
  return { success: true, alreadyExists: false, likeCount: mem.likeCount };
}

export function removeLike(memoryId: string): { success: boolean; likeCount: number } {
  const mem = memories.get(memoryId);
  if (!mem) return { success: false, likeCount: 0 };

  const idx = likes.findIndex(l => l.memoryId === memoryId && l.userId === DEMO_USER.id);
  if (idx < 0) return { success: false, likeCount: mem.likeCount };
  likes.splice(idx, 1);

  mem.likeCount = Math.max(0, mem.likeCount - 1);
  return { success: true, likeCount: mem.likeCount };
}
