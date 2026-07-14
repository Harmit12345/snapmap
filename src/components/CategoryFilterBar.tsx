'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { Category } from '@/lib/types';
import CategoryManagerModal from './CategoryManagerModal';

interface CategoryFilterBarProps {
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export default function CategoryFilterBar({ activeSlug, onSelect }: CategoryFilterBarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showManager, setShowManager] = useState(false);

  const fetchCategories = () => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div className="filter-bar">
      <button
        className={`chip ${activeSlug === null ? 'chip-active' : 'chip-default'}`}
        style={activeSlug === null ? { background: 'var(--accent-primary)' } : {}}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`chip ${activeSlug === cat.slug ? 'chip-active' : 'chip-default'}`}
          style={activeSlug === cat.slug ? { background: cat.color } : {}}
          onClick={() => onSelect(activeSlug === cat.slug ? null : cat.slug)}
        >
          <span>{cat.icon}</span>
          {cat.displayName}
        </button>
      ))}
      <button 
        className="chip chip-default"
        onClick={() => setShowManager(true)}
        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
        title="Manage Categories"
      >
        <Settings size={14} strokeWidth={1.5} /> Manage
      </button>

      {showManager && (
        <CategoryManagerModal 
          onClose={() => {
            setShowManager(false);
            fetchCategories(); // Refresh categories when modal closes
          }} 
        />
      )}
    </div>
  );
}
