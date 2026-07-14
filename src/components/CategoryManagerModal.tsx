'use client';

import { useState, useEffect } from 'react';
import type { Category } from '@/lib/types';

interface CategoryManagerModalProps {
  onClose: () => void;
}

export default function CategoryManagerModal({ onClose }: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIcon, setNewIcon] = useState('📍');
  const [newColor, setNewColor] = useState('#FF5722');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName || !newIcon || !newColor) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newDisplayName,
          icon: newIcon,
          color: newColor,
        })
      });
      if (res.ok) {
        setNewDisplayName('');
        setNewIcon('📍');
        setNewColor('#FF5722');
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Memories using this category will keep it as text but you won\'t be able to filter by it.')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>Manage Categories</h2>
          <button onClick={onClose} className="action-btn" style={{ fontSize: '20px' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{cat.icon}</span>
                  <span style={{ fontWeight: 500 }}>{cat.displayName}</span>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: cat.color }} title={cat.color} />
                </div>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="action-btn"
                  style={{ color: 'var(--error)' }}
                  title="Delete category"
                >
                  🗑️
                </button>
              </div>
            ))}
            {categories.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No custom categories yet.</div>}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Add New Category</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Category Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Work Trip, Hidden Cafe..."
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Emoji Icon</label>
                <input
                  type="text"
                  className="input"
                  placeholder="📍"
                  value={newIcon}
                  onChange={e => setNewIcon(e.target.value)}
                  maxLength={2}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Color</label>
                <input
                  type="color"
                  className="input"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  style={{ padding: '4px', height: '46px', cursor: 'pointer' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !newDisplayName}>
              {isSubmitting ? 'Creating...' : 'Create Category'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
