'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Memory } from '@/lib/types';
import { format } from 'date-fns';

interface MapViewProps {
  memories: Memory[];
  onMemoryClick?: (memories: Memory[]) => void;
}

// Fix default Leaflet marker icons
function createCategoryIcon(color: string, icon: string, count: number = 1): L.DivIcon {
  const badgeHtml = count > 1 ? `
    <div style="
      position: absolute;
      top: -8px;
      right: -8px;
      background: var(--bg-primary);
      color: var(--text-primary);
      border-radius: 12px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      border: 1px solid var(--border-subtle);
      z-index: 10;
    ">${count}</div>
  ` : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position: relative;">
      <div style="
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
      </div>
      ${badgeHtml}
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

  // Group memories by location
  const groupedMemories = new Map<string, Memory[]>();
  for (const memory of memories) {
    const key = `${memory.location.lat.toFixed(6)},${memory.location.lng.toFixed(6)}`;
    const existing = groupedMemories.get(key) || [];
    existing.push(memory);
    groupedMemories.set(key, existing);
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
        {Array.from(groupedMemories.entries()).map(([key, group]) => {
          // Sort group so newest is first
          const sortedGroup = group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const latestMemory = sortedGroup[0];
          const primaryCat = latestMemory.categories.find(c => c.isPrimary) || latestMemory.categories[0];
          
          const markerIcon = createCategoryIcon(
            primaryCat?.color || '#FF5722',
            primaryCat?.icon || '📍',
            sortedGroup.length
          );

          return (
            <Marker
              key={key}
              position={[latestMemory.location.lat, latestMemory.location.lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onMemoryClick?.(sortedGroup),
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
