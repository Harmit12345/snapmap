'use client';

/**
 * LocationPickerMap
 * -----------------
 * Full-screen location picker with world search + crosshair pin.
 * ALSO shows all existing public memories as map pins.
 * Clicking a pin opens a compact side-panel listing those posts.
 *
 * Tiles: CartoDB Voyager (Google Maps-like, light, no API key)
 */

import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Loader2, Navigation2, X, Heart, Image, Calendar, User } from 'lucide-react';
import type { Memory } from '@/lib/types';
import { format } from 'date-fns';

export interface LocationHierarchy {
  city: string | null;
  state: string | null;
  country: string | null;
}

interface LocationPickerMapProps {
  initialLat: number;
  initialLng: number;
  onLocationChange: (lat: number, lng: number, name: string, address: string, hierarchy: LocationHierarchy) => void;
  locationPinned: boolean;
  pinnedName: string;
  pinnedAddress: string;
  pinnedLat: number;
  pinnedLng: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    amenity?: string; road?: string; neighbourhood?: string; suburb?: string;
    village?: string; town?: string; city?: string; county?: string; state?: string; country?: string;
  };
}

// ─── Marker icon (same style as MapView) ───────────────────────────────────
function createCategoryIcon(color: string, icon: string, count: number = 1): L.DivIcon {
  const badge = count > 1 ? `<div style="position:absolute;top:-8px;right:-8px;background:#0A0C10;color:#E6E8EB;border-radius:12px;padding:2px 6px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.15);">${count}</div>` : '';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;">
      <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;">
        <span style="transform:rotate(45deg);font-size:15px;">${icon}</span>
      </div>
      ${badge}
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

// ─── Internal sub-components ────────────────────────────────────────────────
function MapController({ flyTo }: { flyTo: [number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo[0], flyTo[1]], flyTo[2], { animate: true, duration: 1.2 });
  }, [flyTo, map]);
  return null;
}

function CenterTracker({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    move(e)    { const c = e.target.getCenter(); onCenterChange(c.lat, c.lng); },
    moveend(e) { const c = e.target.getCenter(); onCenterChange(c.lat, c.lng); },
  });
  return null;
}

// ─── Helper ─────────────────────────────────────────────────────────────────
function extractLocationData(result: NominatimResult): { name: string; hierarchy: LocationHierarchy } {
  const hierarchy: LocationHierarchy = {
    city: null,
    state: null,
    country: null,
  };

  if (result.address) {
    // Build hierarchy from Nominatim address components
    hierarchy.city = result.address.city || result.address.town || result.address.village || result.address.county || null;
    hierarchy.state = result.address.state || null;
    hierarchy.country = result.address.country || null;

    // For the display name, prefer a recognizable landmark/area name
    // but fall back to city if only a road/neighbourhood is found
    const specificName = result.address.amenity || result.address.road || result.address.neighbourhood || result.address.suburb;
    const cityName = hierarchy.city;

    // If we have a city and the specific name is just a road/neighbourhood,
    // use "SpecificName, City" format for clarity
    let displayName: string;
    if (specificName && cityName && specificName !== cityName) {
      displayName = `${specificName}, ${cityName}`;
    } else if (cityName) {
      displayName = cityName;
    } else if (specificName) {
      displayName = specificName;
    } else {
      displayName = hierarchy.state || hierarchy.country || result.display_name.split(',')[0];
    }

    return { name: displayName, hierarchy };
  }

  return { name: result.display_name.split(',')[0], hierarchy };
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LocationPickerMap({
  initialLat, initialLng,
  onLocationChange,
  locationPinned, pinnedName, pinnedAddress, pinnedLat, pinnedLng,
}: LocationPickerMapProps) {

  // Search
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]   = useState('');

  // Map center (live, updates on pan)
  const [mapCenter, setMapCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [flyTo, setFlyTo]         = useState<[number, number, number] | null>(null);
  const [pinning, setPinning]     = useState(false);

  // Existing memories shown as pins
  const [memories, setMemories]   = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  // Side-panel for clicked pin
  const [panelMemories, setPanelMemories] = useState<Memory[] | null>(null);

  // ─── Fetch all existing memories ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/users/me/timeline?limit=50')
      .then(r => r.json())
      .then(d => setMemories(d.data || []))
      .catch(() => {})
      .finally(() => setMemoriesLoading(false));
  }, []);

  // ─── Group memories by location key ──────────────────────────────────────
  const grouped = new Map<string, Memory[]>();
  for (const m of memories) {
    const key = `${m.location.lat.toFixed(5)},${m.location.lng.toFixed(5)}`;
    grouped.set(key, [...(grouped.get(key) || []), m]);
  }

  // ─── Search (Enter / Go button) ──────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearchLoading(true);
    setSearchError('');
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1&email=snapmap@example.com`);
      const data: NominatimResult[] = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setFlyTo([lat, lng, 13]);
        setMapCenter([lat, lng]);
      } else {
        setSearchError('No results found. Try a different search.');
      }
    } catch { setSearchError('Search failed. Check your connection.'); }
    finally   { setSearchLoading(false); }
  }, [searchQuery]);

  // ─── Pin / reverse geocode ────────────────────────────────────────────────
  const handlePin = async () => {
    setPinning(true);
    const [lat, lng] = mapCenter;
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&email=snapmap@example.com`);
      const data: NominatimResult = await res.json();
      const { name, hierarchy } = extractLocationData(data);
      onLocationChange(lat, lng, name, data.display_name || '', hierarchy);
    } catch { onLocationChange(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`, '', { city: null, state: null, country: null }); }
    finally   { setPinning(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '10px' }}>

      {/* Search row */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <div className="location-search-wrapper" style={{ flex: 1, marginBottom: 0 }}>
          <span className="location-search-icon">
            {searchLoading
              ? <Loader2 size={16} strokeWidth={1.5} className="lucide-spin" />
              : <Search size={16} strokeWidth={1.5} />}
          </span>
          <input
            className="location-search-input"
            type="text"
            placeholder="Search — Rajkot, Rajasthan, Dubai, Paris…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoComplete="off"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searchLoading || searchQuery.trim().length < 2}
          style={{
            padding: '0 18px', background: 'var(--accent-primary)', color: 'var(--text-inverse)',
            border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '14px',
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, display: 'flex',
            alignItems: 'center', gap: '6px',
            opacity: searchLoading || searchQuery.trim().length < 2 ? 0.5 : 1,
            transition: 'all var(--transition-fast)',
          }}
        >
          <Search size={15} strokeWidth={1.5} /> Go
        </button>
      </div>

      {searchError && (
        <p style={{ fontSize: '12px', color: 'var(--error)', margin: '-4px 0 0', flexShrink: 0 }}>
          {searchError}
        </p>
      )}

      {/* Map + side panel row */}
      <div style={{ flex: 1, display: 'flex', gap: '12px', minHeight: 0 }}>

        {/* Map */}
        <div style={{
          flex: 1, position: 'relative',
          borderRadius: 'var(--radius-md)', overflow: 'hidden',
          border: '1px solid var(--border-default)', minHeight: 0,
        }}>
          <MapContainer
            center={[initialLat, initialLng]}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
            attributionControl={false}
          >
            {/* CartoDB Voyager — Google Maps-like light tiles */}
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapController flyTo={flyTo} />
            <CenterTracker onCenterChange={(lat, lng) => setMapCenter([lat, lng])} />

            {/* Existing memory pins */}
            {Array.from(grouped.entries()).map(([key, group]) => {
              const sorted = group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const latest = sorted[0];
              const cat    = latest.categories.find(c => c.isPrimary) || latest.categories[0];
              return (
                <Marker
                  key={key}
                  position={[latest.location.lat, latest.location.lng]}
                  icon={createCategoryIcon(cat?.color || '#FF5722', cat?.icon || '📍', sorted.length)}
                  eventHandlers={{ click: () => setPanelMemories(sorted) }}
                />
              );
            })}
          </MapContainer>

          {/* Crosshair */}
          <div className="map-crosshair">
            <div className="map-crosshair-dot" />
            <div className="map-crosshair-needle" />
          </div>

          {/* Floating hint */}
          <div style={{
            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.62)', color: '#fff', fontSize: '11px',
            padding: '5px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center',
            gap: '5px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1000,
          }}>
            <Navigation2 size={11} strokeWidth={2} />
            Pan &amp; zoom · crosshair marks your pin spot
          </div>

          {/* Memory count badge */}
          {!memoriesLoading && memories.length > 0 && (
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(0,0,0,0.62)', color: '#fff', fontSize: '11px',
              padding: '5px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center',
              gap: '5px', zIndex: 1000, pointerEvents: 'none',
            }}>
              <MapPin size={11} strokeWidth={2} /> {memories.length} memor{memories.length === 1 ? 'y' : 'ies'} posted
            </div>
          )}
        </div>

        {/* Side panel — slides in when a pin is clicked */}
        {panelMemories && (
          <div style={{
            width: '300px', flexShrink: 0,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', animation: 'slideInRight 200ms ease-out',
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} strokeWidth={1.5} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {panelMemories.length === 1 ? '1 memory here' : `${panelMemories.length} memories here`}
                </span>
              </div>
              <button
                onClick={() => setPanelMemories(null)}
                style={{ color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', transition: 'all 150ms' }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Memory list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {panelMemories.map((m, idx) => {
                const thumbnail = m.media.find(med => med.thumbnailUrl || med.url);
                const cat = m.categories.find(c => c.isPrimary) || m.categories[0];
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '12px 14px',
                      borderBottom: idx < panelMemories.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'default',
                    }}
                  >
                    {/* Thumbnail + title row */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnail.thumbnailUrl || thumbnail.url || ''}
                          alt=""
                          style={{
                            width: '60px', height: '60px', borderRadius: '6px',
                            objectFit: 'cover', flexShrink: 0, background: 'var(--bg-tertiary)',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '60px', height: '60px', borderRadius: '6px',
                          background: 'var(--bg-tertiary)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          fontSize: '22px',
                        }}>
                          {cat?.icon || '📍'}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          marginBottom: '2px',
                        }}>
                          {m.title || m.locationName || 'Untitled Memory'}
                        </div>
                        {m.body && (
                          <div style={{
                            fontSize: '12px', color: 'var(--text-secondary)',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            lineHeight: 1.4,
                          }}>
                            {m.body}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {/* Location */}
                      {m.locationName && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <MapPin size={10} strokeWidth={1.5} />
                          {m.locationName}
                        </span>
                      )}
                      {/* Author */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <User size={10} strokeWidth={1.5} />
                        {m.user?.displayName || m.user?.username || 'Unknown'}
                      </span>
                      {/* Date */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <Calendar size={10} strokeWidth={1.5} />
                        {format(new Date(m.createdAt), 'MMM d, yy')}
                      </span>
                      {/* Likes */}
                      {m.likeCount > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <Heart size={10} strokeWidth={1.5} />
                          {m.likeCount}
                        </span>
                      )}
                      {/* Media count */}
                      {m.mediaCount > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <Image size={10} strokeWidth={1.5} />
                          {m.mediaCount}
                        </span>
                      )}
                    </div>

                    {/* Category chip */}
                    {cat && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600,
                          background: cat.color + '25', color: cat.color, border: `1px solid ${cat.color}40`,
                        }}>
                          {cat.icon} {cat.displayName}
                        </span>
                      </div>
                    )}

                    {/* Hashtags */}
                    {m.hashtags && m.hashtags.length > 0 && (
                      <div style={{ marginTop: '5px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {m.hashtags.slice(0, 4).map(tag => (
                          <span key={tag} style={{ fontSize: '10px', color: 'var(--accent-secondary)', fontWeight: 500 }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pin button + pinned card */}
      <div style={{ flexShrink: 0, paddingBottom: '4px' }}>
        <button
          className="pin-location-btn"
          onClick={handlePin}
          disabled={pinning}
          style={{ marginTop: 0 }}
        >
          {pinning
            ? <><Loader2 size={16} className="lucide-spin" strokeWidth={1.5} /> Pinning location…</>
            : <><MapPin size={16} strokeWidth={1.5} /> Pin This Location</>}
        </button>

        {locationPinned && (
          <div className="pinned-location-card">
            <span className="pinned-location-card-icon"><MapPin size={18} strokeWidth={1.5} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pinned-location-name">{pinnedName || 'Pinned Location'}</div>
              {pinnedAddress && pinnedAddress !== pinnedName && (
                <div className="pinned-location-address" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pinnedAddress}
                </div>
              )}
              <div className="pinned-location-coords">{pinnedLat.toFixed(5)}, {pinnedLng.toFixed(5)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
