'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Memory } from '@/lib/types';
import MemoryComposer from '@/components/MemoryComposer';
import MemoryDetailModal from '@/components/MemoryDetailModal';

// Leaflet must be client-side only
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function HomePage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/users/me/timeline?limit=50');
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
  }, []);

  const handleCreated = (memory: Memory) => {
    setMemories(prev => [memory, ...prev]);
  };

  const handleMemoryClick = (memory: Memory) => {
    setSelectedMemory(memory);
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

      {/* Memory count badge */}
      <div style={{
        position: 'fixed',
        bottom: '90px',
        right: '24px',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-full)',
        padding: '8px 16px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
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
      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onUpdate={(updated) => {
            setSelectedMemory(updated);
            setMemories(prev => prev.map(m => m.id === updated.id ? updated : m));
          }}
        />
      )}
    </div>
  );
}
