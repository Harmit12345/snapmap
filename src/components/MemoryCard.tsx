'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { MapPin, Pencil, Trash2, Loader2, MessageCircle, Share2, Hash, Link, Send } from 'lucide-react';
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
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (showComments && comments.length === 0) {
      setLoadingComments(true);
      fetch(`/api/memories/${currentMemory.id}/comments`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setComments(data.data);
          }
        })
        .finally(() => setLoadingComments(false));
    }
  }, [showComments, currentMemory.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/memories/${currentMemory.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText })
      });
      if (res.ok) {
        const data = await res.json();
        setComments([data.data, ...comments]);
        setCommentText('');
        handleUpdate({ ...currentMemory, commentCount: (currentMemory.commentCount || 0) + 1 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      const res = await fetch(`/api/memories/${currentMemory.id}/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setComments(comments.filter(c => c.id !== commentId));
        handleUpdate({ ...currentMemory, commentCount: Math.max(0, (currentMemory.commentCount || 1) - 1) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      const res = await fetch(`/api/memories/${currentMemory.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editingCommentText })
      });
      if (res.ok) {
        const data = await res.json();
        setComments(comments.map(c => c.id === commentId ? data.data : c));
        setEditingCommentId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <LikeButton memory={currentMemory} onUpdate={handleUpdate} />
              <button 
                onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
                className="action-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                title="Comment"
              >
                <MessageCircle size={18} strokeWidth={1.5} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>
                  {showComments && !loadingComments ? comments.length : (currentMemory.commentCount || 0)}
                </span>
              </button>
              
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    setShowShare(!showShare);
                  }}
                  className="action-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Share"
                >
                  <Share2 size={18} strokeWidth={1.5} />
                </button>
                
                {showShare && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '0',
                      width: '180px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-xl)',
                      zIndex: 100,
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <button 
                      onClick={() => {
                        const shareLink = `${window.location.origin}/timeline?memory=${currentMemory.id}`;
                        try {
                          if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(shareLink);
                            alert(`Link copied to clipboard:\n\n${shareLink}`);
                          } else {
                            // Fallback if clipboard API is not available (e.g. non-HTTPS local IP)
                            prompt('Copy this link to share:', shareLink);
                          }
                        } catch (err) {
                          prompt('Copy this link to share:', shareLink);
                        }
                        setShowShare(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, borderRadius: '6px', textAlign: 'left' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                    >
                      <Link size={14} /> Copy Link
                    </button>
                    <button 
                      onClick={() => { setShowShare(false); alert('Simulating Share on X (Twitter)...'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, borderRadius: '6px', textAlign: 'left' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                    >
                      <Hash size={14} /> Share on X
                    </button>
                    <button 
                      onClick={() => { setShowShare(false); alert('Simulating WhatsApp share...'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, borderRadius: '6px', textAlign: 'left' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                  </div>
                )}
              </div>
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

        {/* Inline Comments Section */}
        {showComments && (
          <div style={{ padding: '16px 0 0 0', marginTop: '16px', borderTop: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {loadingComments ? (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <Loader2 size={24} className="lucide-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto' }} />
                </div>
              ) : comments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                  <img 
                    src={comment.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} 
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', border: '1px solid var(--border-subtle)', objectFit: 'cover' }}
                    alt={comment.user?.displayName || 'User'}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{comment.user?.displayName || 'Unknown'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                        {comment.user?.username === 'explorer' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.text); }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              title="Edit"
                            ><Pencil size={12} /></button>
                            <button 
                              onClick={() => handleDeleteComment(comment.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0 }}
                              title="Delete"
                            ><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                        <input 
                          type="text" 
                          value={editingCommentText} 
                          onChange={(e) => setEditingCommentText(e.target.value)} 
                          style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
                          autoFocus
                        />
                        <button 
                          onClick={() => handleUpdateComment(comment.id)}
                          style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                        >Save</button>
                        <button 
                          onClick={() => setEditingCommentId(null)}
                          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
                        >Cancel</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>{comment.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {!loadingComments && comments.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>No comments yet. Be the first!</p>
              )}
            </div>
            
            <form 
              onSubmit={handlePostComment}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}
            >
              <input 
                type="text" 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your thoughts..." 
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px' }}
              />
              <button 
                type="submit" 
                disabled={!commentText.trim()}
                style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: commentText.trim() ? 'pointer' : 'not-allowed', opacity: commentText.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Post <Send size={12} />
              </button>
            </form>
          </div>
        )}
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
