'use client';

import { useEffect, useState, use } from 'react';
import type { Memory } from '@/lib/types';
import MemoryCard from '@/components/MemoryCard';
import LocationFollowButton from '@/components/LocationFollowButton';

interface LocationStats {
  memoryCount: number;
  contributorCount: number;
  subscriberCount: number;
}

interface LocationDetails {
  locationName: string;
  stats: LocationStats;
  isSubscribed: boolean;
  memories: Memory[];
}

export default function LocationPage(props: { params: Promise<{ locationName: string }> }) {
  const params = use(props.params);
  const decodedLocationName = decodeURIComponent(params.locationName);
  
  const [data, setData] = useState<LocationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocation() {
      try {
        const res = await fetch(`/api/locations/${encodeURIComponent(decodedLocationName)}`);
        if (!res.ok) throw new Error('Failed to load location details');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchLocation();
  }, [decodedLocationName]);

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading location details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        {error || 'Location not found.'}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '32px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            📍 {data.locationName}
          </h1>
          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <span><strong>{data.stats.memoryCount}</strong> memories</span>
            <span><strong>{data.stats.contributorCount}</strong> contributors</span>
            <span><strong>{data.stats.subscriberCount}</strong> subscribers</span>
          </div>
        </div>
        <LocationFollowButton 
          locationName={data.locationName} 
          initialIsFollowed={data.isSubscribed} 
        />
      </header>

      {/* Feed */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
          Recent Public Memories
        </h2>
        {data.memories.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No public memories here yet. Be the first!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {data.memories.map(memory => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
