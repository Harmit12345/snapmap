'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Users, Lock, MapPin, Camera, X, Check, Star, Film, Pencil, Tags, Loader2, Sparkles, Navigation } from 'lucide-react';
import type { Memory, Category } from '@/lib/types';

interface MemoryComposerProps {
  onClose: () => void;
  onCreated: (memory: Memory) => void;
  defaultLat?: number;
  defaultLng?: number;
}

interface UploadFile {
  file: File;
  preview: string;
  status: 'waiting' | 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  mediaId?: string;
}

export default function MemoryComposer({ onClose, onCreated, defaultLat = 35.6762, defaultLng = 139.6503 }: MemoryComposerProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
  }, []);

  // Try to get user's location
  const fetchLocation = useCallback(() => {
    setFetchingLocation(true);
    const fetchAddress = async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&email=test@example.com`);
        const data = await res.json();
        if (data && data.address) {
          const exactName = data.address.amenity || data.address.road || data.address.neighbourhood || data.address.suburb || data.address.city || data.address.town || data.address.village;
          if (exactName) {
            setLocationName(exactName);
          } else if (data.display_name) {
            setLocationName(data.display_name.split(',')[0]);
          }
          if (data.display_name) setAddress(data.display_name);
        }
      } catch (e) {
        console.error('Reverse geocoding failed', e);
      } finally {
        setFetchingLocation(false);
      }
    };

    const handleLocation = (latitude: number, longitude: number) => {
      setLat(latitude);
      setLng(longitude);
      fetchAddress(latitude, longitude);
    };

    const fallbackFetch = async () => {
      try {
        const res = await fetch('https://freeipapi.com/api/json');
        const data = await res.json();
        if (data.latitude && data.longitude) {
           return handleLocation(data.latitude, data.longitude);
        }
      } catch(e) {}

      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
           return handleLocation(data.latitude, data.longitude);
        }
      } catch (e) {}

      setFetchingLocation(false);
      fetchAddress(defaultLat, defaultLng);
    };

    if (navigator.geolocation && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleLocation(pos.coords.latitude, pos.coords.longitude),
        fallbackFetch,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      fallbackFetch();
    }
  }, [defaultLat, defaultLng]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: UploadFile[] = Array.from(selectedFiles)
      .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, 10 - files.length)
      .map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        status: 'waiting' as const,
        progress: 0,
      }));
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length]);

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) {
        if (primaryCategoryId === catId) setPrimaryCategoryId(null);
        return prev.filter(id => id !== catId);
      }
      if (prev.length === 0) setPrimaryCategoryId(catId);
      return [...prev, catId];
    });
  };

  const uploadAllFiles = async (memoryId: string) => {
    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      const uf = updatedFiles[i];
      try {
        // Step 1: Presign
        uf.status = 'uploading';
        uf.progress = 20;
        setFiles([...updatedFiles]);

        const presignRes = await fetch(`/api/memories/${memoryId}/media/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: uf.file.type.startsWith('video/') ? 'video' : 'photo',
            mimeType: uf.file.type,
            fileSizeBytes: uf.file.size,
            filename: uf.file.name,
          }),
        });
        const presignData = await presignRes.json();
        uf.mediaId = presignData.data.mediaId;
        uf.progress = 40;
        setFiles([...updatedFiles]);

        // Step 2: Upload file
        const uploadRes = await fetch(presignData.data.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': uf.file.type,
          },
          body: uf.file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.statusText}`);
        }

        uf.progress = 70;
        setFiles([...updatedFiles]);

        // Step 3: Confirm
        const confirmRes = await fetch(`/api/memories/${memoryId}/media/${uf.mediaId}/confirm`, {
          method: 'POST',
        });
        
        if (!confirmRes.ok) {
          throw new Error('Confirm failed');
        }
        uf.status = 'processing';
        uf.progress = 85;
        setFiles([...updatedFiles]);

        // Wait for processing (poll or just wait)
        await new Promise(resolve => setTimeout(resolve, 2500));
        uf.status = 'ready';
        uf.progress = 100;
        setFiles([...updatedFiles]);
      } catch {
        uf.status = 'error';
        setFiles([...updatedFiles]);
      }
    }
  };

  const handleCreate = async () => {
    setCreating(true);

    try {
      // Create the memory
      const parsedHashtags = hashtags
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          body: body || undefined,
          location: { lat, lng },
          locationName: locationName || undefined,
          address: address || undefined,
          visibility,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          primaryCategoryId: primaryCategoryId || undefined,
          hashtags: parsedHashtags.length > 0 ? parsedHashtags : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create memory');
      }

      const data = await res.json();
      const memory = data.data;

      // Upload files if any
      if (files.length > 0) {
        await uploadAllFiles(memory.id);
      }

      // Re-fetch to get updated media
      const finalRes = await fetch(`/api/memories/${memory.id}`);
      const finalData = await finalRes.json();

      onCreated(finalData.data);
      onClose();
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creating) onClose();
  };

  return (
    <>
      <div className="modal-backdrop" onClick={handleBackdropClick} />
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="composer-header">
          <h3 className="composer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step === 1 ? <><Pencil size={20} strokeWidth={1.5} /> Create Memory</> : step === 2 ? <><Camera size={20} strokeWidth={1.5} /> Add Media</> : <><Tags size={20} strokeWidth={1.5} /> Categories</>}
          </h3>
          <div className="composer-step-indicator">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`step-dot ${s === step ? 'active' : ''} ${s < step ? 'completed' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="composer-body">
          {/* Step 1: Text + Location */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Title
                </label>
                <input
                  className="input"
                  placeholder="Give your memory a title..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Story
                </label>
                <textarea
                  className="input"
                  placeholder="Tell the story behind this memory..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  maxLength={5000}
                  rows={4}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                  {body.length}/5000
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Hashtags
                </label>
                <input
                  className="input"
                  placeholder="e.g. food, tokyo, trip (comma separated)"
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Location
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    placeholder={fetchingLocation ? "Locating..." : "Location will appear here"}
                    value={locationName}
                    readOnly
                    style={{ flex: 1, cursor: 'default', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  />
                  <button 
                    onClick={fetchLocation} 
                    className="btn btn-secondary" 
                    disabled={fetchingLocation}
                    style={{ padding: '0 16px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="Fetch current location"
                  >
                    {fetchingLocation ? <Loader2 size={16} className="lucide-spin" strokeWidth={1.5} /> : <Navigation size={16} strokeWidth={1.5} />}
                    {fetchingLocation ? 'Locating...' : 'Locate Me'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Visibility
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['public', 'friends', 'private'] as const).map(v => (
                    <button
                      key={v}
                      className={`chip ${visibility === v ? 'chip-active' : 'chip-default'}`}
                      style={{ ...(visibility === v ? { background: 'var(--accent-primary)' } : {}), display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => setVisibility(v)}
                    >
                      {v === 'public' ? <Globe size={14} strokeWidth={1.5} /> : v === 'friends' ? <Users size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />} 
                      <span style={{ textTransform: 'capitalize' }}>{v}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Media */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files);
                }}
              >
                <div className="upload-zone-icon" style={{ color: 'var(--text-muted)' }}><Camera size={48} strokeWidth={1.5} /></div>
                <p className="upload-zone-text">
                  <strong>Click to upload</strong> or drag and drop
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Photos (up to 20MB) • Videos (up to 500MB) • Max 10 files
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />

              {files.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </div>
                  {files.map((uf, idx) => (
                    <div key={idx} className="upload-item">
                      {uf.file.type.startsWith('video/') ? (
                        <div className="upload-item-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Film size={24} strokeWidth={1.5} />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={uf.preview} alt="" className="upload-item-preview" />
                      )}
                      <div className="upload-item-info">
                        <div className="upload-item-name">{uf.file.name}</div>
                        <div className="upload-item-status">
                          {(uf.file.size / (1024 * 1024)).toFixed(1)} MB
                          {uf.status !== 'waiting' && ` • ${uf.status}`}
                        </div>
                        {uf.status !== 'waiting' && uf.status !== 'ready' && (
                          <div className="upload-progress-bar">
                            <div className="upload-progress-fill" style={{ width: `${uf.progress}%` }} />
                          </div>
                        )}
                      </div>
                      {uf.status === 'waiting' && (
                        <button
                          onClick={() => removeFile(idx)}
                          style={{ fontSize: '16px', color: 'var(--text-muted)', padding: '4px' }}
                        >
                          <X size={16} strokeWidth={1.5} />
                        </button>
                      )}
                      {uf.status === 'ready' && (
                        <span style={{ color: 'var(--success)' }}><Check size={18} strokeWidth={1.5} /></span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Categories */}
          {step === 3 && (
            <div className="animate-fade-in">
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Select categories for your memory. Tap once to add, tap the ★ to make it the primary category (used for the map pin color).
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {categories.map(cat => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  const isPrimary = primaryCategoryId === cat.id;
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <button
                        className={`chip ${isSelected ? 'chip-active' : 'chip-default'}`}
                        style={isSelected ? { background: cat.color } : {}}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        {cat.icon} {cat.displayName}
                      </button>
                      {isSelected && (
                        <button
                          onClick={() => setPrimaryCategoryId(isPrimary ? null : cat.id)}
                          style={{
                            fontSize: '16px',
                            color: isPrimary ? '#fbbf24' : 'var(--text-muted)',
                            padding: '4px',
                            transition: 'all var(--transition-fast)',
                          }}
                          title={isPrimary ? 'Remove primary' : 'Set as primary'}
                        >
                          {isPrimary ? '★' : '☆'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedCategoryIds.length > 0 && (
                <div style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  <strong>Selected:</strong>{' '}
                  {selectedCategoryIds.map(id => {
                    const cat = categories.find(c => c.id === id);
                    return cat ? `${cat.icon} ${cat.displayName}${id === primaryCategoryId ? ' (Primary)' : ''}` : '';
                  }).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="composer-footer">
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            disabled={creating}
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>

          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !lat && !lng}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
              >
              {creating ? (
                <>
                  <Loader2 size={16} className="lucide-spin" strokeWidth={1.5} />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles size={16} strokeWidth={1.5} /> Create Memory
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
