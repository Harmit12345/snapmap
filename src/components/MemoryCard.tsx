'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { Memory } from '@/lib/types';
import MediaCarousel from './MediaCarousel';
import LikeButton from './LikeButton';
import FavoriteButton from './FavoriteButton';
import MemoryDetailModal from './MemoryDetailModal';

interface MemoryCardProps {
  memory: Memory;
  index?: number;
  onUpdate?: (memory: Memory) => void;
}

export default function MemoryCard({ memory, index = 0, onUpdate }: MemoryCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [currentMemory, setCurrentMemory] = useState(memory);

  const handleUpdate = (updated: Memory) => {
    setCurrentMemory(updated);
    onUpdate?.(updated);
  };

  const primaryCategory = currentMemory.categories.find(c => c.isPrimary) || currentMemory.categories[0];

  return (
    <>
      <article
        className="memory-card"
        style={{ animationDelay: `${index * 80}ms` }}
        onClick={() => setShowDetail(true)}
      >
        {currentMemory.media.length > 0 ? (
          <div className="memory-card-media" onClick={(e) => e.stopPropagation()}>
            <MediaCarousel media={currentMemory.media} />
          </div>
        ) : (
          <div
            className="memory-card-media"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: primaryCategory
                ? `linear-gradient(135deg, ${primaryCategory.color}22, ${primaryCategory.color}44)`
                : 'var(--bg-tertiary)',
            }}
          >
            <span style={{ fontSize: '48px', opacity: 0.6 }}>
              {primaryCategory?.icon || '📍'}
            </span>
          </div>
        )}

        <div className="memory-card-body">
          {currentMemory.categories.length > 0 && (
            <div className="card-categories">
              {currentMemory.categories.map(cat => (
                <span
                  key={cat.id}
                  className="card-chip"
                  style={{
                    background: `${cat.color}22`,
                    color: cat.color,
                    border: cat.isPrimary ? `1px solid ${cat.color}44` : 'none',
                  }}
                >
                  {cat.icon} {cat.displayName}
                </span>
              ))}
            </div>
          )}

          {currentMemory.title && (
            <h3 className="memory-card-title">{currentMemory.title}</h3>
          )}
          {currentMemory.body && (
            <p className="memory-card-text">{currentMemory.body}</p>
          )}
        </div>

        <div className="memory-card-footer">
          <div className="memory-card-location">
            <span>📍</span>
            <span>{currentMemory.locationName || 'Unknown location'}</span>
            <span style={{ margin: '0 4px' }}>•</span>
            <span>{format(new Date(currentMemory.createdAt), 'MMM d')}</span>
          </div>

          <div className="memory-card-actions" onClick={(e) => e.stopPropagation()}>
            <LikeButton memory={currentMemory} onUpdate={handleUpdate} />
            <FavoriteButton memory={currentMemory} onUpdate={handleUpdate} />
          </div>
        </div>
      </article>

      {showDetail && (
        <MemoryDetailModal
          memory={currentMemory}
          onClose={() => setShowDetail(false)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
