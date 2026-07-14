'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Memory } from '@/lib/types';
import MediaCarousel from './MediaCarousel';
import LikeButton from './LikeButton';
import FavoriteButton from './FavoriteButton';
import MemoryDetailModal from './MemoryDetailModal';
import MemoryEditModal from './MemoryEditModal';

interface MemoryCardProps {
  memory: Memory;
  index?: number;
  onUpdate?: (memory: Memory) => void;
  onDelete?: (memoryId: string) => void;
}

export default function MemoryCard({ memory, index = 0, onUpdate, onDelete }: MemoryCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [currentMemory, setCurrentMemory] = useState(memory);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this memory?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/memories/${currentMemory.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete?.(currentMemory.id);
      } else {
        console.error('Failed to delete memory');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

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

          {currentMemory.hashtags && currentMemory.hashtags.length > 0 && (
            <div className="card-categories" style={{ marginTop: currentMemory.categories.length ? '8px' : '0' }}>
              {currentMemory.hashtags.map(tag => (
                <span
                  key={tag}
                  className="card-chip"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  #{tag}
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
            <MapPin size={14} color="var(--accent-secondary)" strokeWidth={1.5} />
            <span>{currentMemory.locationName || 'Unknown location'}</span>
            <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>•</span>
            <span>{format(new Date(currentMemory.createdAt), 'MMM d')}</span>
          </div>

          <div className="memory-card-actions" onClick={(e) => e.stopPropagation()}>
            <LikeButton memory={currentMemory} onUpdate={handleUpdate} />
            <FavoriteButton memory={currentMemory} onUpdate={handleUpdate} />
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
                className="action-btn"
                title="Edit memory"
              >
                <span className="action-icon"><Pencil size={16} strokeWidth={1.5} /></span>
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="action-btn"
                style={{ color: 'var(--error)' }}
                title="Delete memory"
              >
                <span className="action-icon">
                  {isDeleting ? <Loader2 size={16} className="lucide-spin" strokeWidth={1.5} /> : <Trash2 size={16} strokeWidth={1.5} />}
                </span>
              </button>
            </div>
          </div>
        </div>
      </article>

      {showDetail && !showEdit && (
        <MemoryDetailModal
          memory={currentMemory}
          onClose={() => setShowDetail(false)}
          onUpdate={handleUpdate}
          onDelete={onDelete}
        />
      )}

      {showEdit && (
        <MemoryEditModal
          memory={currentMemory}
          onClose={() => setShowEdit(false)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
