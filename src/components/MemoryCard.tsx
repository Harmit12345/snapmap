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
import LocationFollowButton from './LocationFollowButton';

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
        className="memory-card linkedin-style-card"
        style={{ animationDelay: `${index * 80}ms`, background: 'var(--bg-primary)', padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}
        onClick={() => setShowDetail(true)}
      >
        {/* Header: User Info & Location */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <img 
            src={currentMemory.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentMemory.userId}`} 
            alt={currentMemory.user?.displayName || 'User'} 
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px', border: '1px solid var(--border-subtle)' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {currentMemory.user?.displayName || 'Unknown User'}
              </h4>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {format(new Date(currentMemory.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <MapPin size={12} color="var(--accent-secondary)" strokeWidth={2} style={{ marginRight: '4px' }} />
              {currentMemory.locationName || 'Unknown location'}
              <span style={{ margin: '0 8px' }}>•</span>
              <LocationFollowButton 
                locationName={currentMemory.locationName} 
                initialIsFollowed={currentMemory.isLocationFollowed || false}
                onUpdate={(isFollowed) => handleUpdate({ ...currentMemory, isLocationFollowed: isFollowed })}
              />
            </div>
          </div>
        </div>

        {/* Media */}
        <div style={{ margin: '0 -16px' }}>
          {currentMemory.media.length > 0 ? (
            <div className="memory-card-media" onClick={(e) => e.stopPropagation()} style={{ borderRadius: '0' }}>
              <MediaCarousel media={currentMemory.media} />
            </div>
          ) : primaryCategory ? (
            <div
              className="memory-card-media"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0',
                background: `linear-gradient(135deg, ${primaryCategory.color}22, ${primaryCategory.color}44)`,
              }}
            >
              <span style={{ fontSize: '48px', opacity: 0.6 }}>
                {primaryCategory.icon || '📍'}
              </span>
            </div>
          ) : null}
        </div>

        {/* Body: Title & Text */}
        <div className="memory-card-body" style={{ padding: '12px 0 0 0' }}>
          {currentMemory.title && (
            <h3 className="memory-card-title" style={{ fontSize: '16px', marginBottom: '8px' }}>{currentMemory.title}</h3>
          )}
          {currentMemory.body && (
            <p className="memory-card-text" style={{ fontSize: '14px', lineHeight: '1.5', WebkitLineClamp: 'unset' }}>{currentMemory.body}</p>
          )}

          {/* Tags */}
          {(currentMemory.categories.length > 0 || (currentMemory.hashtags && currentMemory.hashtags.length > 0)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {currentMemory.categories.map(cat => (
                <span
                  key={cat.id}
                  className="card-chip"
                  style={{
                    background: `${cat.color}15`,
                    color: cat.color,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: cat.isPrimary ? `1px solid ${cat.color}33` : 'none',
                  }}
                >
                  {cat.icon} {cat.displayName}
                </span>
              ))}
              {currentMemory.hashtags?.map(tag => (
                <span
                  key={tag}
                  className="card-chip"
                  style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="memory-card-footer" style={{ borderTop: 'none', padding: '12px 0 0 0', marginTop: '12px', borderTopColor: 'var(--border-subtle)', borderTopStyle: 'solid', borderTopWidth: '1px' }}>
          <div className="memory-card-actions" onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <LikeButton memory={currentMemory} onUpdate={handleUpdate} />
              <FavoriteButton memory={currentMemory} onUpdate={handleUpdate} />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
                className="action-btn"
                title="Edit memory"
              >
                <span className="action-icon"><Pencil size={18} strokeWidth={1.5} /></span>
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="action-btn"
                style={{ color: 'var(--error)' }}
                title="Delete memory"
              >
                <span className="action-icon">
                  {isDeleting ? <Loader2 size={18} className="lucide-spin" strokeWidth={1.5} /> : <Trash2 size={18} strokeWidth={1.5} />}
                </span>
              </button>
            </div>
          </div>
        </div>
      </article>

      {showDetail && !showEdit && (
        <MemoryDetailModal
          memories={[currentMemory]}
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
