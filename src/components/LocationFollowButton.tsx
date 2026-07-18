'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LocationFollowButtonProps {
  locationName: string | null;
  initialIsFollowed: boolean;
  onUpdate?: (isFollowed: boolean) => void;
}

export default function LocationFollowButton({ locationName, initialIsFollowed, onUpdate }: LocationFollowButtonProps) {
  const [isFollowed, setIsFollowed] = useState(initialIsFollowed);
  const [isLoading, setIsLoading] = useState(false);

  if (!locationName) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    const method = isFollowed ? 'DELETE' : 'POST';
    const optimisticVal = !isFollowed;
    
    setIsFollowed(optimisticVal);

    try {
      const res = await fetch('/api/locations/subscribe', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationName }),
      });

      if (res.ok) {
        onUpdate?.(optimisticVal);
      } else {
        // Revert on failure
        setIsFollowed(!optimisticVal);
      }
    } catch (err) {
      setIsFollowed(!optimisticVal);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`card-chip ${isFollowed ? 'active' : ''}`}
      style={{
        background: isFollowed ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
        color: isFollowed ? 'white' : 'var(--text-secondary)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        padding: '2px 8px',
        marginLeft: '6px'
      }}
      disabled={isLoading}
      title={isFollowed ? 'Unfollow this location' : 'Follow this location'}
    >
      {isLoading && <Loader2 size={12} className="lucide-spin" />}
      {isFollowed ? 'Following' : 'Follow'}
    </button>
  );
}
