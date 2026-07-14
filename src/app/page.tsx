'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Memory } from '@/lib/types';
import MemoryComposer from '@/components/MemoryComposer';
import MemoryDetailModal from '@/components/MemoryDetailModal';

// Leaflet must be client-side only
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

function HomePageContent() {
  const searchParams = useSearchParams();
  const search = searchParams.get('search');
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMemories, setSelectedMemories] = useState<Memory[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (search) params.set('search', search);

      const res = await fetch(`/api/users/me/timeline?${params.toString()}`);
      const data = await res.json();
      setMemories(data.data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [search]);

  const handleCreated = (memory: Memory) => {
    setMemories(prev => [memory, ...prev]);
  };

  const handleMemoryClick = (clickedMemories: Memory[]) => {
    setSelectedMemories(clickedMemories);
  };

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - var(--nav-height))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading memories...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 'calc(-1 * var(--nav-height) - 16px)', paddingTop: 'var(--nav-height)' }}>
      <MapView memories={memories} onMemoryClick={handleMemoryClick} />

      {/* Empty State Overlay */}
      {memories.length === 0 && !loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          zIndex: 'var(--z-modal)',
          maxWidth: '300px',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>{search ? '🔍' : '📍'}</div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {search ? 'No results found' : 'No memories yet'}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            {search 
              ? `We couldn't find any memories matching "${search}".` 
              : 'Click the + button to create your first memory here!'}
          </p>
        </div>
      )}

      {/* Memory count badge */}
      <div style={{
        position: 'fixed',
        bottom: '90px',
        right: '24px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 16px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 'var(--z-dropdown)',
      }}>
        📍 {memories.length} memories
      </div>

      {/* FAB */}
      <button
        className="fab"
        onClick={() => setShowComposer(true)}
        title="Create Memory"
      >
        +
      </button>

      {/* Composer Modal */}
      {showComposer && (
        <MemoryComposer
          onClose={() => setShowComposer(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Detail Modal */}
      {selectedMemories && (
        <MemoryDetailModal
          memories={selectedMemories}
          onClose={() => setSelectedMemories(null)}
          onUpdate={(updated) => {
            setSelectedMemories(prev => prev ? prev.map(m => m.id === updated.id ? updated : m) : null);
            setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
          }}
          onDelete={(deletedId) => {
            setSelectedMemories(prev => {
              if (!prev) return null;
              const newArr = prev.filter(m => m.id !== deletedId);
              return newArr.length > 0 ? newArr : null;
            });
            setMemories(prev => prev.filter(m => m.id !== deletedId));
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ height: 'calc(100vh - var(--nav-height))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading map...</span>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
