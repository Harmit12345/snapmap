'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Globe, Users, Lock, Camera, X, Check, Film, Pencil,
  Tags, Loader2, Sparkles, MapPin
} from 'lucide-react';
import type { Memory, Category } from '@/lib/types';
import type { LocationHierarchy } from './LocationPickerMap';
import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={28} className="lucide-spin" strokeWidth={1.5} />
        <div style={{ fontSize: '14px', marginTop: '10px' }}>Loading map…</div>
      </div>
    </div>
  ),
});

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

const STEP_LABELS = ['Media', 'Story', 'Location', 'Categories'];

export default function MemoryComposer({
  onClose, onCreated,
  defaultLat = 20.5937, defaultLng = 78.9629,
}: MemoryComposerProps) {
  const [step, setStep] = useState(1);

  // Story
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');

  // Location
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [locationPinned, setLocationPinned] = useState(false);
  const [locationHierarchy, setLocationHierarchy] = useState<LocationHierarchy>({ city: null, state: null, country: null });

  // Media
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);

  // Submit
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
  }, []);

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

        const uploadRes = await fetch(presignData.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': uf.file.type },
          body: uf.file,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);

        uf.progress = 70;
        setFiles([...updatedFiles]);

        const confirmRes = await fetch(`/api/memories/${memoryId}/media/${uf.mediaId}/confirm`, { method: 'POST' });
        if (!confirmRes.ok) throw new Error('Confirm failed');

        uf.status = 'processing';
        uf.progress = 85;
        setFiles([...updatedFiles]);

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
          city: locationHierarchy.city || undefined,
          state: locationHierarchy.state || undefined,
          country: locationHierarchy.country || undefined,
          visibility,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          primaryCategoryId: primaryCategoryId || undefined,
          hashtags: parsedHashtags.length > 0 ? parsedHashtags : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create memory');
      const data = await res.json();
      const memory = data.data;

      if (files.length > 0) await uploadAllFiles(memory.id);

      const finalRes = await fetch(`/api/memories/${memory.id}`);
      const finalData = await finalRes.json();
      onCreated(finalData.data);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while posting the memory. Check the server logs.');
    } finally {
      setCreating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creating) onClose();
  };

  const stepIcons = [Camera, Pencil, MapPin, Tags];
  const StepIcon = stepIcons[step - 1];

  return (
    <>
      <div
        className="modal-backdrop"
        style={{ backdropFilter: 'none', background: 'rgba(0,0,0,0.6)' }}
      />
      <div
        className="modal-content"
        style={{
          inset: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '100%',
          height: '100dvh',
          maxHeight: '100dvh',
          transform: 'none',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        {/* Header */}
        <div className="composer-header">
          <h3 className="composer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StepIcon size={20} strokeWidth={1.5} />
            {STEP_LABELS[step - 1]}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Step {step} of 4
            </span>
            <div className="composer-step-indicator">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className={`step-dot ${s === step ? 'active' : ''} ${s < step ? 'completed' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={step === 3 ? 'composer-body-map' : 'composer-body'}>

          {/* ─── Step 1: Media ─── */}
          {step === 1 && (
            <div className="animate-fade-in composer-step-content">
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files);
                }}
              >
                <div className="upload-zone-icon" style={{ color: 'var(--text-muted)' }}>
                  <Camera size={48} strokeWidth={1.5} />
                </div>
                <p className="upload-zone-text">
                  <strong>Click to upload</strong> or drag and drop
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Photos (up to 20MB) · Videos (up to 500MB) · Max 10 files
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={e => handleFileSelect(e.target.files)}
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
                          {uf.status !== 'waiting' && ` · ${uf.status}`}
                        </div>
                        {uf.status !== 'waiting' && uf.status !== 'ready' && (
                          <div className="upload-progress-bar">
                            <div className="upload-progress-fill" style={{ width: `${uf.progress}%` }} />
                          </div>
                        )}
                      </div>
                      {uf.status === 'waiting' && (
                        <button onClick={() => removeFile(idx)} style={{ fontSize: '16px', color: 'var(--text-muted)', padding: '4px' }}>
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

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
                You can skip and post a text-only memory →
              </p>
            </div>
          )}

          {/* ─── Step 2: Story ─── */}
          {step === 2 && (
            <div className="animate-fade-in composer-step-content">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Title
                </label>
                <input
                  className="input"
                  placeholder="Give your memory a title…"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Caption / Story
                </label>
                <textarea
                  className="input"
                  placeholder="Tell the story behind this memory…"
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

          {/* ─── Step 3: Location Picker ─── */}
          {step === 3 && (
            <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: '0 -24px -0px', padding: '0 24px' }}>
              <LocationPickerMap
                initialLat={lat}
                initialLng={lng}
                onLocationChange={(newLat, newLng, name, addr, hierarchy) => {
                  setLat(newLat);
                  setLng(newLng);
                  setLocationName(name);
                  setAddress(addr);
                  setLocationHierarchy(hierarchy);
                  setLocationPinned(true);
                }}
                locationPinned={locationPinned}
                pinnedName={locationName}
                pinnedAddress={address}
                pinnedLat={lat}
                pinnedLng={lng}
              />
            </div>
          )}

          {/* ─── Step 4: Categories ─── */}
          {step === 4 && (
            <div className="animate-fade-in composer-step-content">
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Select categories for your memory. Tap once to add, tap ★ to make it primary (controls the map pin color).
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
                          style={{ fontSize: '16px', color: isPrimary ? '#fbbf24' : 'var(--text-muted)', padding: '4px', transition: 'all var(--transition-fast)' }}
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
                <div style={{ marginTop: '20px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong>Selected:</strong>{' '}
                  {selectedCategoryIds.map(id => {
                    const cat = categories.find(c => c.id === id);
                    return cat ? `${cat.icon} ${cat.displayName}${id === primaryCategoryId ? ' (Primary)' : ''}` : '';
                  }).filter(Boolean).join(', ')}
                </div>
              )}

              {/* Location summary before submitting */}
              {locationPinned && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} strokeWidth={1.5} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span>{locationName || address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="composer-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: step === 3 ? '100%' : '600px', margin: '0 auto' }}>
          <button
            className="btn btn-ghost"
            onClick={() => { if (step > 1) setStep(step - 1); else onClose(); }}
            disabled={creating}

          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>

          {step < 4 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !locationPinned}>
              {creating ? (
                <><Loader2 size={16} className="lucide-spin" strokeWidth={1.5} /> Creating…</>
              ) : !locationPinned ? (
                <>📍 Pin a location first</>
              ) : (
                <><Sparkles size={16} strokeWidth={1.5} /> Post Memory</>
              )}
            </button>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
