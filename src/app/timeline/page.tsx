'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import type { Memory } from '@/lib/types';
import MemoryCard from '@/components/MemoryCard';
import CategoryFilterBar from '@/components/CategoryFilterBar';
import MemoryComposer from '@/components/MemoryComposer';

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

export default function TimelinePage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchTimeline = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setMemories([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (!reset && cursor) params.set('cursor', cursor);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/users/me/timeline?${params}`);
      const data = await res.json();

      if (reset) {
        setMemories(data.data || []);
      } else {
        setMemories(prev => [...prev, ...(data.data || [])]);
      }
      setCursor(data.pagination?.nextCursor || null);
      setHasMore(data.pagination?.hasMore || false);
    } catch {
      // handle error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, categoryFilter]);

  // Initial load & category change
  useEffect(() => {
    setCursor(null);
    fetchTimeline(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

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

  const groups = groupByDay(memories);

  return (
    <div className="timeline-container">
      <div className="page-header" style={{ padding: '0 0 0' }}>
        <h1>Your Timeline</h1>
        <p>All your memories, ordered by when they happened</p>
      </div>

      <CategoryFilterBar
        activeSlug={categoryFilter}
        onSelect={setCategoryFilter}
      />

      {loading ? (
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
            {categoryFilter
              ? 'Try selecting a different category or create a new memory.'
              : 'Start creating memories by tapping the + button on the map!'}
          </p>
          {!categoryFilter && (
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
          {Array.from(groups.entries()).map(([dayKey, dayMemories]) => (
            <div key={dayKey}>
              <div className="timeline-day-header">
                {formatDayHeader(dayKey)}
              </div>
              <div className="memory-list">
                {dayMemories.map((memory, idx) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    index={idx}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </div>
          ))}

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
