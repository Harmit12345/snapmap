'use client';

import { useState, useEffect } from 'react';
import type { Category, Memory } from '@/lib/types';

interface MemoryEditModalProps {
  memory: Memory;
  onClose: () => void;
  onUpdate: (updatedMemory: Memory) => void;
}

export default function MemoryEditModal({ memory, onClose, onUpdate }: MemoryEditModalProps) {
  const [title, setTitle] = useState(memory.title || '');
  const [body, setBody] = useState(memory.body || '');
  const [hashtags, setHashtags] = useState(memory.hashtags ? memory.hashtags.map(h => `#${h}`).join(', ') : '');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(memory.visibility);
  
  const initialPrimary = memory.categories.find(c => c.isPrimary);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(initialPrimary ? initialPrimary.id : (memory.categories.length > 0 ? memory.categories[0].id : null));
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(memory.categories.map(c => c.id));
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedHashtags = hashtags
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const res = await fetch(`/api/memories/${memory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          body: body || undefined,
          visibility,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          primaryCategoryId: primaryCategoryId || undefined,
          hashtags: parsedHashtags.length > 0 ? parsedHashtags : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to update memory');

      const data = await res.json();
      onUpdate(data.data);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) {
        const next = prev.filter(id => id !== catId);
        if (primaryCategoryId === catId) {
          setPrimaryCategoryId(next.length > 0 ? next[0] : null);
        }
        return next;
      }
      if (prev.length === 0) setPrimaryCategoryId(catId);
      return [...prev, catId];
    });
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }} />
      <div className="modal-content detail-modal" style={{ zIndex: 1001 }}>
        <div className="detail-header">
          <h3>Edit Memory</h3>
          <button onClick={onClose} className="action-btn" style={{ marginLeft: 'auto', fontSize: '20px' }}>✕</button>
        </div>

        <div className="detail-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Title (Optional)</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this memory a title..."
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Description</label>
            <textarea
              className="input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What happened here?"
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Hashtags (Optional)</label>
            <input
              type="text"
              className="input"
              placeholder="#sunset, #goodtimes"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Categories</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.map(cat => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    className={`chip ${isSelected ? 'chip-active' : 'chip-default'}`}
                    style={isSelected ? { background: cat.color } : {}}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <span>{cat.icon}</span> {cat.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Visibility</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['public', 'friends', 'private'] as const).map(v => (
                <button
                  key={v}
                  className={`chip ${visibility === v ? 'chip-active' : 'chip-default'}`}
                  style={visibility === v ? { background: 'var(--accent-primary)' } : {}}
                  onClick={() => setVisibility(v)}
                >
                  {v === 'public' ? '🌍' : v === 'friends' ? '👥' : '🔒'} {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="detail-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ marginRight: '8px' }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
