'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Pencil, Trash2, Loader2, Calendar, X, Globe, Users, Lock, MessageSquare, Paperclip } from 'lucide-react';
import type { Memory } from '@/lib/types';
import MediaCarousel from './MediaCarousel';
import LikeButton from './LikeButton';
import FavoriteButton from './FavoriteButton';
import MemoryEditModal from './MemoryEditModal';
import LocationFollowButton from './LocationFollowButton';

interface MemoryDetailModalProps {
  memories: Memory[];
  onClose: () => void;
  onUpdate?: (memory: Memory) => void;
  onDelete?: (memoryId: string) => void;
}

export default function MemoryDetailModal({ memories, onClose, onUpdate, onDelete }: MemoryDetailModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  const handleDelete = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    setDeletingId(memoryId);
    try {
      const res = await fetch(`/api/memories/${memoryId}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete?.(memoryId);
      } else {
        console.error('Failed to delete memory');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick} />
      <div className="modal-content detail-modal" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        
        {/* Fixed Header with close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', zIndex: 10 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <h3 style={{ margin: 0, fontSize: '16px' }}>{memories.length > 1 ? `${memories.length} Memories at this Location` : 'Memory Details'}</h3>
             {memories.length > 0 && memories[0].locationName && (
               <LocationFollowButton 
                 locationName={memories[0].locationName} 
                 initialIsFollowed={memories[0].isLocationFollowed || false}
                 onUpdate={(isFollowed) => {
                   if (onUpdate) onUpdate({ ...memories[0], isLocationFollowed: isFollowed });
                 }}
               />
             )}
           </div>
           <button
            onClick={onClose}
            style={{
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
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {memories.map((memory, index) => (
            <div key={memory.id} style={{ 
              borderBottom: index < memories.length - 1 ? '1px solid var(--border-subtle)' : 'none', 
              marginBottom: index < memories.length - 1 ? '32px' : 0, 
              paddingBottom: index < memories.length - 1 ? '32px' : 0 
            }}>
              
              {/* Individual Memory Content */}
              <div className="detail-header" style={{ marginBottom: '16px', padding: 0, border: 'none' }}>
                <div className="detail-avatar">
                  {memory.user.displayName.charAt(0)}
                </div>
                <div className="detail-user-info">
                  <h3 style={{ fontSize: '15px' }}>{memory.user.displayName}</h3>
                  <p>@{memory.user.username} • {format(new Date(memory.createdAt), 'MMM d, yyyy \'at\' h:mm a')}</p>
                </div>
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

                {memory.hashtags && memory.hashtags.length > 0 && (
                  <div className="card-categories" style={{ marginBottom: '16px' }}>
                    {memory.hashtags.map(tag => (
                      <span
                        key={tag}
                        className="card-chip"
                        style={{
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                          padding: '4px 12px',
                          fontSize: '12px',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {memory.title && <h2>{memory.title}</h2>}
                {memory.body && <p className="body-text">{memory.body}</p>}

                <div className="detail-location">
                  <MapPin size={18} color="var(--accent-secondary)" strokeWidth={1.5} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                      {memory.locationName || 'Pinned Location'}
                      <LocationFollowButton 
                        locationName={memory.locationName} 
                        initialIsFollowed={memory.isLocationFollowed || false}
                        onUpdate={(isFollowed) => {
                          if (onUpdate) onUpdate({ ...memory, isLocationFollowed: isFollowed });
                        }}
                      />
                    </div>
                    {memory.address && (
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>{memory.address}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span className="visibility-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {memory.visibility === 'public' ? <Globe size={14} strokeWidth={1.5} /> : memory.visibility === 'friends' ? <Users size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />}
                    <span style={{ textTransform: 'capitalize' }}>{memory.visibility}</span>
                  </span>
                  {memory.memoryDate !== memory.createdAt && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} strokeWidth={1.5} /> Memory from {format(new Date(memory.memoryDate), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="detail-actions">
                <LikeButton memory={memory} onUpdate={onUpdate} />
                <FavoriteButton memory={memory} onUpdate={onUpdate} />
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setEditingMemory(memory)}
                    className="action-btn"
                    title="Edit memory"
                  >
                    <span className="action-icon"><Pencil size={16} strokeWidth={1.5} /></span>
                  </button>
                  
                  <button 
                    onClick={() => handleDelete(memory.id)} 
                    disabled={deletingId === memory.id}
                    className="action-btn"
                    style={{ color: 'var(--error)' }}
                    title="Delete memory"
                  >
                    <span className="action-icon">{deletingId === memory.id ? <Loader2 size={16} className="lucide-spin" strokeWidth={1.5} /> : <Trash2 size={16} strokeWidth={1.5} />}</span>
                  </button>
                </div>

                <div style={{ marginLeft: '16px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{memory.commentCount} <MessageSquare size={14} strokeWidth={1.5} /></span>
                  <span>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{memory.mediaCount} <Paperclip size={14} strokeWidth={1.5} /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingMemory && (
        <MemoryEditModal
          memory={editingMemory}
          onClose={() => setEditingMemory(null)}
          onUpdate={(updated) => {
            onUpdate?.(updated);
            setEditingMemory(null);
          }}
        />
      )}
    </>
  );
}
