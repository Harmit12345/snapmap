-- ============================================================
-- Location Memory Management — Full DDL
-- PostgreSQL 14+ with PostGIS extension
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE memory_status AS ENUM ('draft', 'published', 'archived', 'deleted');
CREATE TYPE memory_visibility AS ENUM ('public', 'friends', 'private');
CREATE TYPE media_type AS ENUM ('photo', 'video');
CREATE TYPE media_status AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE category_source AS ENUM ('user', 'ai');

-- ============================================================
-- CATEGORIES (reference table, seeded by the product team)
-- ============================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            TEXT NOT NULL UNIQUE,          -- url-safe key, e.g. 'hidden-gem'
    display_name    TEXT NOT NULL,                  -- user-facing label
    icon            TEXT,                           -- emoji or icon class
    color           TEXT,                           -- hex color for UI chips
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_active_sort ON categories (is_active, sort_order);

-- Seed some starter categories
INSERT INTO categories (slug, display_name, icon, color, sort_order) VALUES
    ('food-drink',    'Food & Drink',    '🍜', '#FF6B35', 1),
    ('nature',        'Nature',          '🌿', '#2D6A4F', 2),
    ('nightlife',     'Nightlife',       '🌙', '#7B2D8B', 3),
    ('hidden-gem',    'Hidden Gem',      '💎', '#0077B6', 4),
    ('culture',       'Culture',         '🎭', '#E63946', 5),
    ('adventure',     'Adventure',       '🏔️', '#F4A261', 6),
    ('shopping',      'Shopping',        '🛍️', '#E76F51', 7),
    ('relaxation',    'Relaxation',      '🧘', '#83C5BE', 8),
    ('photography',   'Photography',     '📸', '#264653', 9),
    ('local-tip',     'Local Tip',       '📌', '#E9C46A', 10);

-- ============================================================
-- MEMORIES (the core entity)
-- ============================================================

CREATE TABLE memories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,                 -- FK to your auth/users table
    title           TEXT,                           -- optional short title
    body            TEXT,                           -- markdown or plain text
    location        geography(Point, 4326) NOT NULL,
    location_name   TEXT,                           -- human-readable place name
    address         TEXT,                           -- reverse-geocoded or user-entered
    visibility      memory_visibility NOT NULL DEFAULT 'public',
    status          memory_status NOT NULL DEFAULT 'published',

    -- Denormalized counters (updated via triggers or application logic)
    like_count      INT NOT NULL DEFAULT 0,
    comment_count   INT NOT NULL DEFAULT 0,
    favorite_count  INT NOT NULL DEFAULT 0,         -- private; only shown to memory owner
    media_count     INT NOT NULL DEFAULT 0,

    -- Timestamps
    memory_date     TIMESTAMPTZ,                   -- user-chosen "when this happened" date
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ                    -- soft delete timestamp

    -- NOTE: user_id FK intentionally omitted here because the users table
    -- lives in the auth module. Add the FK in your migration if both tables
    -- are in the same database:
    -- CONSTRAINT fk_memories_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Spatial index — required for ST_DWithin "nearby" queries
CREATE INDEX idx_memories_location ON memories USING GIST (location);

-- Owner's timeline (cursor pagination by created_at DESC, id DESC)
CREATE INDEX idx_memories_user_timeline
    ON memories (user_id, created_at DESC, id DESC)
    WHERE status != 'deleted';

-- Public/friend feed (visibility + recency)
CREATE INDEX idx_memories_public_feed
    ON memories (created_at DESC, id DESC)
    WHERE status = 'published' AND visibility = 'public';

-- Soft delete filter
CREATE INDEX idx_memories_status ON memories (status) WHERE status = 'deleted';

-- ============================================================
-- MEMORY MEDIA (photos and videos attached to a memory)
-- ============================================================

CREATE TABLE memory_media (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id           UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    uploader_id         UUID NOT NULL,             -- must match memory.user_id at creation

    type                media_type NOT NULL,
    status              media_status NOT NULL DEFAULT 'pending',
    sort_order          INT NOT NULL DEFAULT 0,

    -- S3 keys (not full URLs — construct URLs at read time using your CDN domain)
    storage_key         TEXT NOT NULL,              -- original upload key
    thumbnail_key       TEXT,                       -- generated thumbnail key
    optimized_key       TEXT,                       -- transcoded/compressed key (video)

    -- Metadata (populated by the processing worker)
    mime_type           TEXT,
    file_size_bytes     BIGINT,
    width               INT,
    height              INT,
    duration_seconds    FLOAT,                      -- video only
    blurhash            TEXT,                       -- compact placeholder for loading state

    -- EXIF
    exif_lat            DOUBLE PRECISION,
    exif_lng            DOUBLE PRECISION,
    exif_taken_at       TIMESTAMPTZ,

    -- Processing
    processing_error    TEXT,                       -- error message if status='failed'
    processed_at        TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_memory ON memory_media (memory_id, sort_order);
CREATE INDEX idx_media_status ON memory_media (status) WHERE status IN ('pending', 'processing');

-- ============================================================
-- MEMORY CATEGORIES (many-to-many join table)
-- ============================================================
--
-- Design rationale:
--   • is_primary: at most one row per memory can be TRUE (enforced by partial unique index).
--     The primary category is used for the dominant chip color and map pin icon.
--   • source: 'user' for categories chosen by the memory author,
--     'ai' for categories auto-applied by an AI tagger (Phase 4).
--     Both can coexist on the same memory.
-- ============================================================

CREATE TABLE memory_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    source          category_source NOT NULL DEFAULT 'user',
    confidence      FLOAT,                         -- AI confidence score (NULL for user-applied)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (memory_id, category_id)                -- prevent duplicate category on same memory
);

-- At most one primary category per memory
CREATE UNIQUE INDEX idx_memory_primary_category
    ON memory_categories (memory_id)
    WHERE is_primary = TRUE;

CREATE INDEX idx_memory_categories_category ON memory_categories (category_id);

-- ============================================================
-- LIKES (public social signal)
-- ============================================================

CREATE TABLE memory_likes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (memory_id, user_id)
);

CREATE INDEX idx_likes_user ON memory_likes (user_id, created_at DESC);

-- ============================================================
-- FAVORITES (private bookmark — never exposed to other users)
-- ============================================================

CREATE TABLE memory_favorites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id       UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (memory_id, user_id)
);

-- User's "Saved" list, cursor-paginated
CREATE INDEX idx_favorites_user ON memory_favorites (user_id, created_at DESC, id DESC);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Convenience function: create a Point from lat/lng
CREATE OR REPLACE FUNCTION make_point(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS geography AS $$
    SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$ LANGUAGE SQL IMMUTABLE STRICT;

-- Example: "memories within 5 km of a point"
-- SELECT m.*
-- FROM memories m
-- WHERE m.status = 'published'
--   AND m.visibility = 'public'
--   AND ST_DWithin(m.location, make_point(37.7749, -122.4194), 5000)
-- ORDER BY m.created_at DESC
-- LIMIT 20;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_memory_media_updated_at
    BEFORE UPDATE ON memory_media
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TRIGGER: sync denormalized counters
-- ============================================================

-- Like count
CREATE OR REPLACE FUNCTION trigger_sync_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE memories SET like_count = like_count + 1 WHERE id = NEW.memory_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE memories SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.memory_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_like_count
    AFTER INSERT OR DELETE ON memory_likes
    FOR EACH ROW EXECUTE FUNCTION trigger_sync_like_count();

-- Favorite count
CREATE OR REPLACE FUNCTION trigger_sync_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE memories SET favorite_count = favorite_count + 1 WHERE id = NEW.memory_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE memories SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = OLD.memory_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_favorite_count
    AFTER INSERT OR DELETE ON memory_favorites
    FOR EACH ROW EXECUTE FUNCTION trigger_sync_favorite_count();

-- Media count
CREATE OR REPLACE FUNCTION trigger_sync_media_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE memories SET media_count = media_count + 1 WHERE id = NEW.memory_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE memories SET media_count = GREATEST(media_count - 1, 0) WHERE id = OLD.memory_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_media_count
    AFTER INSERT OR DELETE ON memory_media
    FOR EACH ROW EXECUTE FUNCTION trigger_sync_media_count();
