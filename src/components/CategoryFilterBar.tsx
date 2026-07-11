'use client';

import { useState, useEffect } from 'react';
import type { Category } from '@/lib/types';

interface CategoryFilterBarProps {
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export default function CategoryFilterBar({ activeSlug, onSelect }: CategoryFilterBarProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
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
    </div>
  );
}
