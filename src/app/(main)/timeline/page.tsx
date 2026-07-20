'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import type { Memory } from '@/lib/types';
import MemoryCard from '@/components/MemoryCard';
import CategoryFilterBar from '@/components/CategoryFilterBar';
import MemoryComposer from '@/components/MemoryComposer';
import LocationFollowButton from '@/components/LocationFollowButton';

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d, yyyy');
}

function groupByDay(memories: Memory[]): Map<string, Memory[]> {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const dayKey = startOfDay(new Date(memory.createdAt)).toISOString();
    const existing = groups.get(dayKey) || [];
    existing.push(memory);
    groups.set(dayKey, existing);
  }
  return groups;
}

function TimelinePageContent() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search');

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [timelineMode, setTimelineMode] = useState<'my-memories' | 'following'>('following');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [searchFollowed, setSearchFollowed] = useState(false);

  const fetchTimeline = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setMemories([]);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('_t', Date.now().toString()); // Cache buster
      if (!reset && cursor) params.set('cursor', cursor);
      if (categoryFilter) params.set('category', categoryFilter);
      if (search) params.set('search', search);

      const endpoint = timelineMode === 'following' ? '/api/users/me/feed' : '/api/users/me/timeline';
      const res = await fetch(`${endpoint}?${params}`);
      
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Unknown API error');

      if (reset) {
        setMemories(data.data || []);
      } else {
        setMemories(prev => [...prev, ...(data.data || [])]);
      }
      setCursor(data.pagination?.nextCursor || null);
      setHasMore(data.pagination?.hasMore || false);
    } catch (err: any) {
      console.error('Failed to fetch timeline:', err);
      setError(err.message || 'Failed to load timeline.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, categoryFilter, search, timelineMode]);

  // Initial load & category/search change
  useEffect(() => {
    setCursor(null);
    fetchTimeline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, search, timelineMode]);

  // Fetch subscription status for the searched location
  useEffect(() => {
    if (!search) {
      setSearchFollowed(false);
      return;
    }
    fetch(`/api/locations/subscribe?locationName=${encodeURIComponent(search)}`)
      .then(res => res.json())
      .then(data => setSearchFollowed(data.isSubscribed || false))
      .catch(() => setSearchFollowed(false));
  }, [search]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchTimeline(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, fetchTimeline]);

  const handleCreated = (memory: Memory) => {
    setMemories(prev => [memory, ...prev]);
  };

  const handleUpdate = (updated: Memory) => {
    setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  const handleDelete = (deletedId: string) => {
    setMemories(prev => prev.filter(m => m.id !== deletedId));
  };

  const groups = groupByDay(memories);

  return (
    <div className="timeline-container">
      <div className="page-header" style={{ padding: '0 0 0' }}>
        <h1>{timelineMode === 'following' ? 'Your Feed' : 'Your Timeline'}</h1>
        <p>{timelineMode === 'following' ? 'Memories from places you follow' : 'All your memories, ordered by when they happened'}</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
        <button
          onClick={() => setTimelineMode('following')}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: timelineMode === 'following' ? 'var(--bg-glass)' : 'transparent',
            boxShadow: timelineMode === 'following' ? 'var(--shadow-sm)' : 'none',
            color: timelineMode === 'following' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: timelineMode === 'following' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Following
        </button>
        <button
          onClick={() => setTimelineMode('my-memories')}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: timelineMode === 'my-memories' ? 'var(--bg-glass)' : 'transparent',
            boxShadow: timelineMode === 'my-memories' ? 'var(--shadow-sm)' : 'none',
            color: timelineMode === 'my-memories' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: timelineMode === 'my-memories' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          My Memories
        </button>
      </div>

      <CategoryFilterBar
        activeSlug={categoryFilter}
        onSelect={setCategoryFilter}
      />

      {/* Search Header */}
      {search && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          border: '1px solid var(--border-subtle)'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Search: <strong>{search}</strong>
          </span>
          <LocationFollowButton locationName={search} initialIsFollowed={searchFollowed} />
        </div>
      )}

      {error ? (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Error Loading Timeline</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button onClick={() => fetchTimeline(true)} style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading timeline...</span>
        </div>
      ) : memories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📱</div>
          <h3 className="empty-state-title">
            {categoryFilter ? 'No memories in this category' : 'No memories yet'}
          </h3>
          <p className="empty-state-text">
            {search
              ? `We couldn't find any memories matching "${search}".`
              : timelineMode === 'following' 
                ? 'You are not following any places yet, or there are no memories in your followed places. Go to the map and click Follow on a place!' 
                : categoryFilter
                  ? 'Try selecting a different category or create a new memory.'
                  : 'Start creating memories by tapping the + button on the map!'}
          </p>
          {!search && !categoryFilter && timelineMode === 'my-memories' && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={() => setShowComposer(true)}
            >
              ✨ Create Your First Memory
            </button>
          )}
        </div>
      ) : (
        <>
          {timelineMode === 'following' ? (
            <div className="memory-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {memories.map((memory, idx) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  index={idx}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            Array.from(groups.entries()).map(([dayKey, dayMemories]) => (
              <div key={dayKey}>
                <div className="timeline-day-header">
                  {formatDayHeader(dayKey)}
                </div>
                <div className="memory-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {dayMemories.map((memory, idx) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      index={idx}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
            {loadingMore && (
              <div className="loading-dots">
                <span /><span /><span />
              </div>
            )}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        className="fab"
        onClick={() => setShowComposer(true)}
        title="Create Memory"
      >
        +
      </button>

      {showComposer && (
        <MemoryComposer
          onClose={() => setShowComposer(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div className="loading-container" style={{ margin: '0 auto' }}>
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)' }}>Loading timeline...</span>
        </div>
      </div>
    }>
      <TimelinePageContent />
    </Suspense>
  );
}
