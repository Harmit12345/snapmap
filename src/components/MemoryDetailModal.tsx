'use client';

import { format } from 'date-fns';
import type { Memory } from '@/lib/types';
import MediaCarousel from './MediaCarousel';
import LikeButton from './LikeButton';
import FavoriteButton from './FavoriteButton';

interface MemoryDetailModalProps {
  memory: Memory;
  onClose: () => void;
  onUpdate?: (memory: Memory) => void;
}

export default function MemoryDetailModal({ memory, onClose, onUpdate }: MemoryDetailModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick} />
      <div className="modal-content detail-modal">
        {/* Header */}
        <div className="detail-header">
          <div className="detail-avatar">
            {memory.user.displayName.charAt(0)}
          </div>
          <div className="detail-user-info">
            <h3>{memory.user.displayName}</h3>
            <p>@{memory.user.username} • {format(new Date(memory.createdAt), 'MMM d, yyyy \'at\' h:mm a')}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              fontSize: '20px',
              color: 'var(--text-muted)',
              padding: '8px',
              borderRadius: 'var(--radius-full)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            ✕
          </button>
        </div>

        {/* Media */}
        {memory.media.length > 0 && (
          <MediaCarousel media={memory.media} />
        )}

        {/* Body */}
        <div className="detail-body">
          {memory.categories.length > 0 && (
            <div className="card-categories" style={{ marginBottom: '16px' }}>
              {memory.categories.map(cat => (
                <span
                  key={cat.id}
                  className="card-chip"
                  style={{
                    background: `${cat.color}22`,
                    color: cat.color,
                    border: cat.isPrimary ? `1px solid ${cat.color}44` : 'none',
                    padding: '4px 12px',
                    fontSize: '12px',
                  }}
                >
                  {cat.icon} {cat.displayName}
                  {cat.isPrimary && <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.7 }}>★</span>}
                </span>
              ))}
            </div>
          )}

          {memory.title && <h2>{memory.title}</h2>}
          {memory.body && <p className="body-text">{memory.body}</p>}

          <div className="detail-location">
            <span>📍</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {memory.locationName || 'Pinned Location'}
              </div>
              {memory.address && (
                <div style={{ fontSize: '12px', marginTop: '2px' }}>{memory.address}</div>
              )}
              <div style={{ fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>
                {memory.location.lat.toFixed(4)}, {memory.location.lng.toFixed(4)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span className="visibility-badge">
              {memory.visibility === 'public' ? '🌍' : memory.visibility === 'friends' ? '👥' : '🔒'}
              {memory.visibility}
            </span>
            {memory.memoryDate !== memory.createdAt && (
              <span>📅 Memory from {format(new Date(memory.memoryDate), 'MMM d, yyyy')}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="detail-actions">
          <LikeButton memory={memory} onUpdate={onUpdate} />
          <FavoriteButton memory={memory} onUpdate={onUpdate} />
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>
            {memory.commentCount} 💬 • {memory.mediaCount} 📎
          </div>
        </div>
      </div>
    </>
  );
}
