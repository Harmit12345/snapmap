'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Category, Memory } from '@/lib/types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {});
  }, []);

  // Try to get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {} // silently fail
      );
    }
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
        const formData = new FormData();
        formData.append('file', uf.file);
        await fetch(presignData.data.uploadUrl, {
          method: 'POST',
          body: formData,
        });
        uf.progress = 70;
        setFiles([...updatedFiles]);

        // Step 3: Confirm
        await fetch(`/api/memories/${memoryId}/media/${uf.mediaId}/confirm`, {
          method: 'POST',
        });
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
        }),
      });

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
          <h3 className="composer-title">
            {step === 1 ? '📝 Create Memory' : step === 2 ? '📸 Add Media' : '🏷️ Categories'}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    📍 Place Name
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Fuunji Ramen"
                    value={locationName}
                    onChange={e => setLocationName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Address
                  </label>
                  <input
                    className="input"
                    placeholder="Street address..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Latitude
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={e => setLat(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Longitude
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={e => setLng(parseFloat(e.target.value) || 0)}
                  />
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
                      style={visibility === v ? { background: 'var(--accent-primary)' } : {}}
                      onClick={() => setVisibility(v)}
                    >
                      {v === 'public' ? '🌍' : v === 'friends' ? '👥' : '🔒'} {v}
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
                <div className="upload-zone-icon">📸</div>
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
                        <div className="upload-item-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          🎬
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
                          ✕
                        </button>
                      )}
                      {uf.status === 'ready' && (
                        <span style={{ color: 'var(--success)', fontSize: '18px' }}>✓</span>
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
              style={creating ? { opacity: 0.7 } : {}}
            >
              {creating ? (
                <>
                  <div className="processing-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  Creating...
                </>
              ) : (
                '✨ Create Memory'
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
