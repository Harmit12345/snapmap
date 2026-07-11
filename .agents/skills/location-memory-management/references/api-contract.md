# Location Memory Management — API Contract

> All endpoints require `Authorization: Bearer <token>` unless noted.
> All request/response bodies are `application/json`.
> Dates are ISO 8601 UTC strings.
> IDs are UUID v4.

---

## Common Types

### Cursor Pagination

Every list endpoint uses cursor-based pagination. The cursor encodes `(created_at, id)`.

**Query Parameters (all list endpoints):**

| Param    | Type   | Default | Description                                       |
|----------|--------|---------|---------------------------------------------------|
| `cursor` | string | —       | Opaque cursor from the previous page's `nextCursor` |
| `limit`  | int    | 20      | Items per page (max 50)                            |

**Response Envelope (all list endpoints):**

```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJjIjoiMjAyNS0wNi0...",  // null if no more pages
    "hasMore": true
  }
}
```

### Media Object (embedded in memory responses)

```json
{
  "id": "uuid",
  "type": "photo | video",
  "status": "pending | processing | ready | failed",
  "sortOrder": 0,
  "url": "https://cdn.example.com/...",           // null if not ready
  "thumbnailUrl": "https://cdn.example.com/...",   // null if not ready
  "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",     // compact placeholder
  "width": 1920,
  "height": 1080,
  "durationSeconds": 42.5,                         // video only, null for photos
  "mimeType": "image/jpeg",
  "fileSizeBytes": 2048576
}
```

### Category Object

```json
{
  "id": "uuid",
  "slug": "hidden-gem",
  "displayName": "Hidden Gem",
  "icon": "💎",
  "color": "#0077B6",
  "isPrimary": true,
  "source": "user | ai",
  "confidence": null
}
```

---

## Endpoints

---

### `POST /api/memories`

Create a new memory (text + location). Media is added in a separate presign → upload → confirm flow.

**Request Body:**

```json
{
  "title": "Best ramen in Shibuya",                         // optional
  "body": "Found this tiny shop down an alley...",           // optional
  "location": {
    "lat": 35.6595,
    "lng": 139.7004
  },
  "locationName": "Fuunji",                                 // optional
  "address": "2-14-3 Yoyogi, Shibuya, Tokyo 151-0053",      // optional
  "visibility": "public",                                    // public | friends | private
  "memoryDate": "2025-06-15T14:30:00Z",                     // optional, defaults to now()
  "categoryIds": ["uuid-1"],                                 // optional, array of category UUIDs
  "primaryCategoryId": "uuid-1"                              // optional, must be in categoryIds
}
```

**Response `201 Created`:**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "title": "Best ramen in Shibuya",
    "body": "Found this tiny shop down an alley...",
    "location": { "lat": 35.6595, "lng": 139.7004 },
    "locationName": "Fuunji",
    "address": "2-14-3 Yoyogi, Shibuya, Tokyo 151-0053",
    "visibility": "public",
    "status": "published",
    "memoryDate": "2025-06-15T14:30:00Z",
    "likeCount": 0,
    "commentCount": 0,
    "favoriteCount": 0,
    "mediaCount": 0,
    "media": [],
    "categories": [
      {
        "id": "uuid-1",
        "slug": "food-drink",
        "displayName": "Food & Drink",
        "icon": "🍜",
        "color": "#FF6B35",
        "isPrimary": true,
        "source": "user",
        "confidence": null
      }
    ],
    "isFavorited": false,
    "isLiked": false,
    "createdAt": "2025-06-20T10:00:00Z",
    "updatedAt": "2025-06-20T10:00:00Z"
  }
}
```

**Errors:**

| Status | Code                    | When                                 |
|--------|-------------------------|--------------------------------------|
| 400    | `INVALID_LOCATION`      | lat/lng out of range                 |
| 400    | `INVALID_CATEGORY`      | categoryId not found or inactive     |
| 400    | `BODY_TOO_LONG`         | body exceeds 5000 chars              |
| 401    | `UNAUTHORIZED`          | missing or invalid token             |

---

### `POST /api/memories/:memoryId/media/presign`

Request a presigned S3 upload URL for one media file.

**Request Body:**

```json
{
  "type": "photo",                    // photo | video
  "mimeType": "image/jpeg",
  "fileSizeBytes": 2048576,           // used for quota/limit checks
  "filename": "IMG_2045.jpg"          // optional, for content-disposition
}
```

**Response `200 OK`:**

```json
{
  "data": {
    "mediaId": "uuid",
    "uploadUrl": "https://s3.region.amazonaws.com/bucket/...",
    "storageKey": "uploads/user-uuid/memory-uuid/media-uuid.jpg",
    "expiresAt": "2025-06-20T10:15:00Z"
  }
}
```

**Errors:**

| Status | Code                   | When                                   |
|--------|------------------------|----------------------------------------|
| 400    | `UNSUPPORTED_TYPE`     | mime type not in allow-list            |
| 400    | `FILE_TOO_LARGE`       | exceeds per-file limit (photo 20 MB, video 500 MB) |
| 400    | `TOO_MANY_MEDIA`       | memory already has max media (10)      |
| 403    | `NOT_OWNER`            | authenticated user doesn't own memory  |
| 404    | `MEMORY_NOT_FOUND`     | memory doesn't exist or is deleted     |

---

### `POST /api/memories/:memoryId/media/:mediaId/confirm`

Mark upload complete and enqueue processing.

**Request Body:** _empty or `{}`_

**Response `200 OK`:**

```json
{
  "data": {
    "mediaId": "uuid",
    "status": "processing"
  }
}
```

**Errors:**

| Status | Code                     | When                                 |
|--------|--------------------------|--------------------------------------|
| 400    | `ALREADY_CONFIRMED`      | media is not in `pending` status     |
| 403    | `NOT_OWNER`              | authenticated user doesn't own media |
| 404    | `MEDIA_NOT_FOUND`        | mediaId doesn't exist                |

---

### `GET /api/memories/:memoryId`

Fetch a single memory with all media and categories.

**Response `200 OK`:**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "username": "akira",
      "displayName": "Akira T.",
      "avatarUrl": "https://..."
    },
    "title": "Best ramen in Shibuya",
    "body": "Found this tiny shop...",
    "location": { "lat": 35.6595, "lng": 139.7004 },
    "locationName": "Fuunji",
    "address": "...",
    "visibility": "public",
    "status": "published",
    "memoryDate": "2025-06-15T14:30:00Z",
    "likeCount": 12,
    "commentCount": 3,
    "favoriteCount": 5,
    "mediaCount": 2,
    "media": [ /* Media Objects */ ],
    "categories": [ /* Category Objects */ ],
    "isFavorited": false,
    "isLiked": true,
    "createdAt": "2025-06-20T10:00:00Z",
    "updatedAt": "2025-06-20T10:05:00Z"
  }
}
```

**Privacy enforcement:**
- If `visibility = 'private'` and requester is not the owner → `404 MEMORY_NOT_FOUND`
- If `visibility = 'friends'` and requester is not the owner or a friend → `404 MEMORY_NOT_FOUND`
- Return `404` (not `403`) to avoid revealing that a private memory exists.

---

### `PATCH /api/memories/:memoryId`

Edit memory text, categories, or visibility. Only the owner can edit.

**Request Body (all fields optional):**

```json
{
  "title": "Updated title",
  "body": "Updated body text",
  "visibility": "friends",
  "locationName": "New Place Name",
  "memoryDate": "2025-06-14T12:00:00Z",
  "categoryIds": ["uuid-1", "uuid-2"],
  "primaryCategoryId": "uuid-1"
}
```

**Response `200 OK`:** Same shape as `GET /api/memories/:id`.

---

### `DELETE /api/memories/:memoryId`

Soft delete. Sets `status = 'deleted'` and `deleted_at = now()`.

**Response `200 OK`:**

```json
{
  "data": {
    "id": "uuid",
    "status": "deleted"
  }
}
```

---

### `GET /api/users/me/timeline`

The authenticated user's own memories. No visibility filtering (you can see all your own content).

**Query Parameters:**

| Param      | Type   | Default | Description                        |
|------------|--------|---------|------------------------------------|
| `cursor`   | string | —       | Pagination cursor                  |
| `limit`    | int    | 20      | Items per page (max 50)            |
| `category` | string | —       | Filter by category slug            |
| `status`   | string | —       | Filter by status (draft, published, archived) |

**Response `200 OK`:** Paginated list of memory objects (same shape as `GET /api/memories/:id` response, wrapped in the pagination envelope).

---

### `GET /api/users/:userId/memories`

Another user's public memories. Privacy-filtered.

**Query Parameters:**

| Param      | Type   | Default | Description                        |
|------------|--------|---------|------------------------------------|
| `cursor`   | string | —       | Pagination cursor                  |
| `limit`    | int    | 20      | Items per page (max 50)            |
| `category` | string | —       | Filter by category slug            |

**Privacy rules:**
- Only returns memories where `visibility = 'public'` (or `'friends'` if requester is a friend of the owner).
- `status` must be `'published'`.

**Response `200 OK`:** Paginated list envelope.

---

### `GET /api/categories`

List all active categories for the composer and filter UI.

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "food-drink",
      "displayName": "Food & Drink",
      "icon": "🍜",
      "color": "#FF6B35",
      "sortOrder": 1
    }
  ]
}
```

---

### `POST /api/memories/:memoryId/favorite`

Add memory to the authenticated user's saved/favorites list.

**Request Body:** _empty or `{}`_

**Response `201 Created`:**

```json
{
  "data": {
    "memoryId": "uuid",
    "favoritedAt": "2025-06-20T10:30:00Z"
  }
}
```

**Errors:**

| Status | Code                   | When                                 |
|--------|------------------------|--------------------------------------|
| 409    | `ALREADY_FAVORITED`    | user already favorited this memory   |
| 404    | `MEMORY_NOT_FOUND`     | memory not found or not visible      |

---

### `DELETE /api/memories/:memoryId/favorite`

Remove memory from favorites.

**Response `200 OK`:**

```json
{
  "data": {
    "memoryId": "uuid",
    "unfavoritedAt": "2025-06-20T10:35:00Z"
  }
}
```

---

### `GET /api/users/me/favorites`

The authenticated user's favorited memories, newest first.

**Query Parameters:**

| Param    | Type   | Default | Description           |
|----------|--------|---------|-----------------------|
| `cursor` | string | —       | Pagination cursor     |
| `limit`  | int    | 20      | Items per page (max 50) |

**Response `200 OK`:** Paginated list of memory objects (same shape as individual memory response), ordered by `favorited_at DESC`.

---

### `POST /api/memories/:memoryId/like`

Like a memory (public social signal).

**Request Body:** _empty or `{}`_

**Response `201 Created`:**

```json
{
  "data": {
    "memoryId": "uuid",
    "likeCount": 13,
    "likedAt": "2025-06-20T11:00:00Z"
  }
}
```

---

### `DELETE /api/memories/:memoryId/like`

Remove a like.

**Response `200 OK`:**

```json
{
  "data": {
    "memoryId": "uuid",
    "likeCount": 12,
    "unlikedAt": "2025-06-20T11:05:00Z"
  }
}
```

---

## Error Response Shape

All errors follow a consistent shape:

```json
{
  "error": {
    "code": "MEMORY_NOT_FOUND",
    "message": "The requested memory does not exist.",
    "details": {}
  }
}
```

---

## Rate Limits

| Endpoint Group         | Limit              |
|------------------------|--------------------|
| Memory creation        | 30 per hour        |
| Media presign          | 60 per hour        |
| Reads (GET)            | 300 per minute     |
| Like / Favorite toggle | 120 per minute     |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 297
X-RateLimit-Reset: 1719907200
```
