'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Memory } from '@/lib/types';
import MemoryCard from '@/components/MemoryCard';

export default function FavoritesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchFavorites = useCallback(async (reset = false) => {
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

      const res = await fetch(`/api/users/me/favorites?${params}`);
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
  }, [cursor]);

  useEffect(() => {
    fetchFavorites(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchFavorites(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, fetchFavorites]);

  const handleUpdate = (updated: Memory) => {
    if (!updated.isFavorited) {
      // Remove from favorites list
      setMemories(prev => prev.filter(m => m.id !== updated.id));
    } else {
      setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <h1>Saved Memories</h1>
        <p>Your private bookmarks — only you can see these</p>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading saved...</span>
        </div>
      ) : memories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔖</div>
          <h3 className="empty-state-title">No saved memories yet</h3>
          <p className="empty-state-text">
            Tap the ☆ bookmark button on any memory to save it here. Favorites are private — only you can see this list.
          </p>
        </div>
      ) : (
        <>
          <div className="favorites-grid">
            {memories.map((memory, idx) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                index={idx}
                onUpdate={handleUpdate}
              />
            ))}
          </div>

          <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
            {loadingMore && (
              <div className="loading-dots" style={{ justifyContent: 'center' }}>
                <span /><span /><span />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
