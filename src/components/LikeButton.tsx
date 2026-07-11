'use client';

import { useState } from 'react';
import type { Memory } from '@/lib/types';

interface LikeButtonProps {
  memory: Memory;
  onUpdate?: (memory: Memory) => void;
}

export default function LikeButton({ memory, onUpdate }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(memory.isLiked);
  const [count, setCount] = useState(memory.likeCount);
  const [animating, setAnimating] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic update
    const wasLiked = isLiked;
    const prevCount = count;
    setIsLiked(!wasLiked);
    setCount(wasLiked ? prevCount - 1 : prevCount + 1);
    if (!wasLiked) setAnimating(true);

    try {
      const res = await fetch(`/api/memories/${memory.id}/like`, {
        method: wasLiked ? 'DELETE' : 'POST',
      });

      if (!res.ok) {
        // Rollback
        setIsLiked(wasLiked);
        setCount(prevCount);
      } else {
        const data = await res.json();
        if (data.data?.likeCount !== undefined) {
          setCount(data.data.likeCount);
        }
        if (onUpdate) {
          onUpdate({
            ...memory,
            isLiked: !wasLiked,
            likeCount: data.data?.likeCount ?? (wasLiked ? prevCount - 1 : prevCount + 1),
          });
        }
      }
    } catch {
      setIsLiked(wasLiked);
      setCount(prevCount);
    }

    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <button
      className={`action-btn ${isLiked ? 'liked' : ''}`}
      onClick={toggle}
      title={isLiked ? 'Unlike' : 'Like'}
    >
      <span className={`action-icon ${animating ? 'liked' : ''}`} style={animating ? { animation: 'heartBeat 0.6s ease-out' } : undefined}>
        {isLiked ? '❤️' : '🤍'}
      </span>
      <span>{count}</span>
    </button>
  );
}
