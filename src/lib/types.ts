// ============================================================
// Location Memory Management — TypeScript Types
// Matches references/api-contract.md exactly
// ============================================================

export type MemoryStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type MemoryVisibility = 'public' | 'friends' | 'private';
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type CategorySource = 'user' | 'ai';

// ---- Category ----

export interface Category {
  id: string;
  slug: string;
  displayName: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MemoryCategory {
  id: string;
  slug: string;
  displayName: string;
  icon: string;
  color: string;
  isPrimary: boolean;
  source: CategorySource;
  confidence: number | null;
}

// ---- Media ----

export interface MediaObject {
  id: string;
  type: MediaType;
  status: MediaStatus;
  sortOrder: number;
  url: string | null;
  thumbnailUrl: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  mimeType: string;
  fileSizeBytes: number;
}

// ---- User ----

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

// ---- Memory ----

export interface Memory {
  id: string;
  userId: string;
  user: UserSummary;
  title: string | null;
  body: string | null;
  location: { lat: number; lng: number };
  locationName: string | null;
  address: string | null;
  visibility: MemoryVisibility;
  status: MemoryStatus;
  memoryDate: string;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  mediaCount: number;
  media: MediaObject[];
  categories: MemoryCategory[];
  hashtags?: string[];
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isFavorited: boolean;
  isLiked: boolean;
  isLocationFollowed?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Pagination ----

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

// ---- API Error ----

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

// ---- Create Memory Request ----

export interface CreateMemoryRequest {
  title?: string;
  body?: string;
  location: { lat: number; lng: number };
  locationName?: string;
  address?: string;
  visibility?: MemoryVisibility;
  memoryDate?: string;
  categoryIds?: string[];
  primaryCategoryId?: string;
  hashtags?: string[];
}

// ---- Presign Request ----

export interface PresignRequest {
  type: MediaType;
  mimeType: string;
  fileSizeBytes: number;
  filename?: string;
}

export interface PresignResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}
