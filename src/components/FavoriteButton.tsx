'use client';

import { useState } from 'react';
import type { Memory } from '@/lib/types';

interface FavoriteButtonProps {
  memory: Memory;
  onUpdate?: (memory: Memory) => void;
}

export default function FavoriteButton({ memory, onUpdate }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(memory.isFavorited);
  const [animating, setAnimating] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);
    if (!wasFavorited) setAnimating(true);

    try {
      const res = await fetch(`/api/memories/${memory.id}/favorite`, {
        method: wasFavorited ? 'DELETE' : 'POST',
      });

      if (!res.ok && res.status !== 409) {
        setIsFavorited(wasFavorited);
      } else {
        if (onUpdate) {
          onUpdate({
            ...memory,
            isFavorited: !wasFavorited,
            favoriteCount: wasFavorited
              ? memory.favoriteCount - 1
              : memory.favoriteCount + 1,
          });
        }
      }
    } catch {
      setIsFavorited(wasFavorited);
    }

    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <button
      className={`action-btn ${isFavorited ? 'favorited' : ''}`}
      onClick={toggle}
      title={isFavorited ? 'Remove from Saved' : 'Save'}
    >
      <span
        className="action-icon"
        style={animating ? { animation: 'heartBeat 0.6s ease-out' } : undefined}
      >
        {isFavorited ? '⭐' : '☆'}
      </span>
    </button>
  );
}
