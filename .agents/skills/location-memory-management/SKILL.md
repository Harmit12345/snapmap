---
name: location-memory-management
description: >
  Provides the full-stack architecture, data model, API contract, media upload pipeline,
  and pitfall checklist for building geotagged "memory" creation, multi-photo/video attachments,
  personal timelines, category tagging, and save/favorite bookmarking on a location-based social
  app (React/Next.js + Node/Express + PostgreSQL/PostGIS + S3 stack). Use this whenever
  implementing memory CRUD endpoints, geotagged post creation, photo/video upload flows,
  timeline or feed pagination, category/tag systems, or favorite/bookmark features — even if
  the user just says "let's build memory creation" or "add favorites" without naming this skill.
---

# Location Memory Management — Full-Stack Implementation Guide

## Scope

Covers five features from a location-memory app's roadmap: **create memory** (text + photo/video + location), **rich media support**, **personal timeline**, **categories**, and **save/favorite**. It assumes auth, the interactive map UI, and push notifications are handled elsewhere — this is the CRUD + media + feed layer underneath them.

**Stack assumed unless told otherwise:** React/Next.js frontend, Node/Express backend, PostgreSQL with PostGIS, S3-compatible object storage. If the project uses Cloudinary instead of raw S3, skip the manual transcoding steps in "Media Pipeline" — Cloudinary does that server-side and you just call its API and store the returned URLs.

Full DDL and endpoint specs live in `references/schema.sql` and `references/api-contract.md`. **Read those before writing migrations or route handlers** — this file explains the decisions, those files give the exact shapes to implement.

---

## Architecture Decisions (and why they matter here)

These five decisions are expensive to reverse once real data exists. Resolve them before writing endpoint code.

### 1. Media upload bypasses the app server

The client requests a presigned S3 URL, uploads the file bytes directly to S3, then calls a `confirm` endpoint. File bytes never pass through Node.

> [!IMPORTANT]
> Phone-camera video is routinely 50–200 MB; proxying that through Express risks request timeouts and memory pressure on every upload, and it's the single most common reason "create memory" features feel broken in testing.

### 2. Processing is async, always

`confirm` marks the media row `processing` and enqueues a background job (thumbnail generation for photos, transcode + keyframe thumbnail for video). The HTTP response for creating a memory returns immediately with media in a `pending` state; the UI shows a placeholder until a status flips to `ready`.

> [!WARNING]
> Transcoding takes seconds to minutes. If it's synchronous, "Create Memory" becomes the slowest, most timeout-prone endpoint in the app for no reason — nothing about posting a memory requires the user to wait for that.

### 3. Categories are many-to-many, not a single column

`memory_categories` is a join table with an `is_primary` flag and a `source` field (`user` vs `ai`), not a `category_id` column on `memories`.

> [!NOTE]
> Phase 4 of the roadmap wants AI-generated automatic tags. If Phase 2 ships a rigid single-select category, Phase 4 needs a migration and backfill to add a second tagging path. Modeling it as many-to-many now costs one extra join table and avoids that rework entirely — and it lets a memory carry a user-chosen category alongside AI-suggested tags without them competing for the same column.

### 4. Favorites and Likes are separate tables with an explicit, documented difference

Don't build both without deciding why both exist.

**Recommendation:**
- **Like** is a public social signal — visible count, appears in the activity feed, signals "I saw this."
- **Favorite** is a private bookmark — never shown to anyone else, only surfaces in the owner's own "Saved" list.

> [!CAUTION]
> If that distinction isn't true for this product, cut one of the two features instead of shipping two schema-identical tables.

### 5. Location is a PostGIS `geography` column, not two floats

Never store lat/lng as separate float columns if "Discover Nearby" (Phase 2) is coming.

> [!IMPORTANT]
> A `geography(Point, 4326)` column with a GIST index turns "memories within N km" into one `ST_DWithin` query. Two floats turn it into bounding-box math you'll get subtly wrong near the poles or the ±180° meridian, and you'll end up migrating to PostGIS later anyway — just start there.

---

## Media Pipeline (the highest-risk part of this feature set)

```
┌─────────┐    presign     ┌─────────┐
│ Client  │───────────────▶│  Server │  → creates memory_media row (status='pending')
│         │◀───────────────│         │  ← returns { mediaId, uploadUrl, storageKey }
└────┬────┘                └─────────┘
     │
     │  PUT file directly
     ▼
┌─────────┐
│   S3    │
└────┬────┘
     │
     │  confirm
     ▼
┌─────────┐    enqueue     ┌──────────┐
│  Server │───────────────▶│  Worker  │  → download, thumbnail, transcode
│         │                │          │  → upload results back to S3
│         │◀───────────────│          │  ← update row: status='ready'
└─────────┘                └──────────┘
```

1. Client calls `POST /api/memories/:id/media/presign` with file metadata (`type`, `size`, `mime`). Server creates a `memory_media` row with `status='pending'` and returns `{ mediaId, uploadUrl, storageKey }`.
2. Client PUTs the file directly to `uploadUrl`.
3. Client calls `POST /api/memories/:id/media/:mediaId/confirm`. Server sets `status='processing'` and enqueues a job (BullMQ/Redis, SQS, or a simple DB-polled queue table for an MVP — pick based on what's already in the stack).
4. Worker downloads the object, generates a thumbnail (`sharp` for photos, `ffmpeg` for a video keyframe + transcode to a web-friendly codec/bitrate), uploads results back to S3, and updates the row: `status='ready'`, `thumbnail_key`, `width`, `height`, `duration_seconds`.
5. Client polls the memory (or subscribes via SSE/websocket if one already exists) until every media item is `ready`; the timeline shows a blurred placeholder for anything still processing.

### EXIF vs. Manual Pin

If a photo carries GPS EXIF data, decide precedence once and document it:

> [!TIP]
> **Recommendation:** A manually placed map pin always wins, and EXIF is only used to suggest a starting pin position before the user places one, never to silently override a placed pin after the fact.

---

## API Surface

Full request/response shapes are in `references/api-contract.md`. Summary:

| Endpoint | Purpose |
|---|---|
| `POST /api/memories` | Create memory shell (text + location metadata) |
| `POST /api/memories/:id/media/presign` | Get a presigned upload URL for one media file |
| `POST /api/memories/:id/media/:mediaId/confirm` | Mark upload complete, enqueue processing |
| `GET /api/memories/:id` | Fetch one memory with its media and categories |
| `PATCH /api/memories/:id` | Edit text/categories/visibility |
| `DELETE /api/memories/:id` | Soft delete (`status='deleted'`) |
| `GET /api/users/me/timeline` | Personal timeline — cursor-paginated, no privacy filter |
| `GET /api/users/:id/memories` | Another user's memories — cursor-paginated, privacy-filtered |
| `GET /api/categories` | List available categories for the composer/filter UI |
| `POST /api/memories/:id/favorite` / `DELETE ...` | Toggle favorite |
| `GET /api/users/me/favorites` | Cursor-paginated saved list |

### Pagination

Pagination is **cursor-based** (`created_at`, `id`), not `OFFSET/LIMIT`.

> [!WARNING]
> `OFFSET` pagination degrades on large tables and produces duplicate or skipped rows when new memories are inserted while a user is mid-scroll — which will happen constantly on a live feed.

---

## Frontend Component Map

| Component | Responsibility |
|---|---|
| **MemoryComposer** | Multi-step: (1) text + location with draggable map pin defaulting to current GPS or EXIF; (2) media picker with client-side compression (`browser-image-compression` or similar); (3) category chips, multi-select, one markable as primary |
| **MediaUploader** | Requests presigned URLs, PUTs directly to S3, shows per-file progress, retries on failure, calls `confirm` on success |
| **TimelineFeed** | Infinite scroll on cursor, grouped by day. Renders blurred/skeleton state for media still processing |
| **CategoryFilterBar** | Chips sourced from `GET /api/categories`, sets a filter query param on the feed |
| **FavoriteButton** | Optimistic toggle with rollback on request failure |

---

## Common Pitfalls

### N+1 queries on the timeline
Loading media and categories per-memory in a loop instead of a single batched join/IN query will look fine with 10 test memories and fall over at scale. Batch-load media and categories for the whole page of results in one or two extra queries, not one per memory.

### Blocking the create-memory request on transcoding
If this slips in, video uploads will time out in normal usage, not just under load — see Media Pipeline above.

### Privacy filtering applied inconsistently
A memory's `visibility` must be checked on every read path except the owner's own personal timeline. Missing this on the "Discover Nearby" or public profile path is a real privacy leak, not just a bug.

### Category/tag rework
If categories were already built as a single column before this skill was consulted, migrating to the many-to-many model in `references/schema.sql` before Phase 4 starts is cheaper than doing it after AI tagging is live and categories have real data.

### Confusing Like and Favorite in the UI copy
Not just the schema — if users can't tell the two buttons apart, the schema-level distinction doesn't help.

---

## Definition of Done

- [ ] Video upload never blocks the HTTP response — confirmed with a large (100 MB+) test file
- [ ] Timeline and favorites lists use cursor pagination, not OFFSET
- [ ] Categories are stored many-to-many with `is_primary` and `source`
- [ ] Privacy (`visibility`) is enforced on every non-owner read path, verified with a private memory viewed by a second test account
- [ ] Favorites and Likes exist as separate tables with a documented, UI-visible difference
- [ ] `location` uses `geography(Point, 4326)` with a GIST index; a sample `ST_DWithin` query has been run through `EXPLAIN` before shipping "Discover Nearby"
