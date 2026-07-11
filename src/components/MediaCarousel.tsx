'use client';

import { useState } from 'react';
import type { MediaObject } from '@/lib/types';

interface MediaCarouselProps {
  media: MediaObject[];
}

export default function MediaCarousel({ media }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const readyMedia = media.filter(m => m.status === 'ready');
  const processingCount = media.filter(m => m.status === 'processing' || m.status === 'pending').length;

  if (media.length === 0) {
    return (
      <div className="carousel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📷</span>
          No media attached
        </div>
      </div>
    );
  }

  const allItems = [
    ...readyMedia,
    ...Array(processingCount).fill(null),
  ];

  const goTo = (index: number) => {
    if (index >= 0 && index < allItems.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <div className="carousel">
      {allItems.map((item, idx) => (
        <div
          key={idx}
          className="carousel-slide"
          style={{
            opacity: idx === currentIndex ? 1 : 0,
            pointerEvents: idx === currentIndex ? 'auto' : 'none',
          }}
        >
          {item === null ? (
            <div className="media-processing" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="processing-spinner" />
              <span>Processing media...</span>
            </div>
          ) : item.type === 'video' ? (
            <video
              src={item.url || ''}
              controls
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url || ''}
              alt="Memory media"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      ))}

      {allItems.length > 1 && (
        <>
          <button className="carousel-nav prev" onClick={() => goTo(currentIndex - 1)}>‹</button>
          <button className="carousel-nav next" onClick={() => goTo(currentIndex + 1)}>›</button>
          <div className="carousel-dots">
            {allItems.map((_, idx) => (
              <button
                key={idx}
                className={`carousel-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => goTo(idx)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
