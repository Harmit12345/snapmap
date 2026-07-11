'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Memory } from '@/lib/types';
import { format } from 'date-fns';

interface MapViewProps {
  memories: Memory[];
  onMemoryClick?: (memory: Memory) => void;
}

// Fix default Leaflet marker icons
function createCategoryIcon(color: string, icon: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      background: ${color};
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">
      <span style="transform: rotate(45deg); font-size: 16px;">${icon}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function FitBounds({ memories }: { memories: Memory[] }) {
  const map = useMap();

  useEffect(() => {
    if (memories.length === 0) return;
    const bounds = L.latLngBounds(
      memories.map(m => [m.location.lat, m.location.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [memories, map]);

  return null;
}

export default function MapView({ memories, onMemoryClick }: MapViewProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="map-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <MapContainer
        center={[35, 20]}
        zoom={2}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds memories={memories} />
        {memories.map(memory => {
          const primaryCat = memory.categories.find(c => c.isPrimary) || memory.categories[0];
          const markerIcon = createCategoryIcon(
            primaryCat?.color || '#6366f1',
            primaryCat?.icon || '📍'
          );

          return (
            <Marker
              key={memory.id}
              position={[memory.location.lat, memory.location.lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onMemoryClick?.(memory),
              }}
            >
              <Popup>
                <div className="popup-card">
                  <div className="popup-card-title">{memory.title || 'Untitled Memory'}</div>
                  {memory.body && <p className="popup-card-text">{memory.body}</p>}
                  <div className="popup-card-meta">
                    <span>📍 {memory.locationName || 'Unknown'}</span>
                    <span>{format(new Date(memory.createdAt), 'MMM d')}</span>
                    <span>❤️ {memory.likeCount}</span>
                  </div>
                  {primaryCat && (
                    <div style={{ marginTop: '8px' }}>
                      <span
                        className="card-chip"
                        style={{
                          background: `${primaryCat.color}22`,
                          color: primaryCat.color,
                        }}
                      >
                        {primaryCat.icon} {primaryCat.displayName}
                      </span>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
