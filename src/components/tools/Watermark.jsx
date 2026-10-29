import React, { useState, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BatchStrip } from '../common/BatchStrip';
import { applyWatermark } from '../../utils/imageProcessing';
import { downloadBlob, downloadAsZip } from '../../utils/zipExporter';
import { Stamp, Download, Archive, RefreshCw, Type, Image as ImageIcon, Grid } from 'lucide-react';

export const Watermark = () => {
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [type, setType] = useState('text'); // 'text' or 'logo'
  const [text, setText] = useState('COPYRIGHT © 2026');
  const [fontSize, setFontSize] = useState(36);
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.65);
  const [rotation, setRotation] = useState(-25);
  const [position, setPosition] = useState('center'); // 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tiled'
  const [logoFile, setLogoFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const handleFilesSelected = (newFiles) => {
    const fileObjects = newFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file)
    }));
    setFiles((prev) => [...prev, ...fileObjects]);
  };

  const handleApplyAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const newResults = [];

    try {
      for (const item of files) {
        const res = await applyWatermark(item.file, {
          type,
          text,
          fontSize,
          color,
          opacity,
          rotation,
          position,
          logoFile
        });
        newResults.push(res);
      }
      setResults(newResults);
    } catch (err) {
      console.error('Watermark error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (files.length > 0) {
      handleApplyAll();
    }
  }, [type, text, fontSize, color, opacity, rotation, position, logoFile, files.length]);

  if (files.length === 0) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#3b82f6' }}>
              <Stamp size={24} />
            </div>
            <div>
              <h2 className="workspace-title">Image Watermark Tool</h2>
              <p className="workspace-subtitle">Stamp text or your logo with custom opacity, angle and tiled grids</p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} multiple={true} title="Drop images to watermark" />
      </div>
    );
  }

  const currentResult = results[activeIndex];

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#3b82f6' }}>
            <Stamp size={24} />
          </div>
          <div>
            <h2 className="workspace-title">Image Watermark Tool</h2>
            <p className="workspace-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} in workspace</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {results.length > 1 && (
            <button className="btn btn-secondary" onClick={() => downloadAsZip(results, 'watermarked_images.zip')}>
              <Archive size={16} />
              <span>Download All as ZIP</span>
            </button>
          )}
          {currentResult && (
            <button className="btn btn-primary" onClick={() => downloadBlob(currentResult.blob, currentResult.fileName)}>
              <Download size={16} />
              <span>Download Watermarked</span>
            </button>
          )}
        </div>
      </div>

      <BatchStrip
        files={files.map((f, i) => ({ ...f, processed: !!results[i] }))}
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onRemoveFile={(idx) => {
          setFiles((prev) => prev.filter((_, i) => i !== idx));
          setResults((prev) => prev.filter((_, i) => i !== idx));
        }}
        onAddFiles={handleFilesSelected}
      />

      <div className="studio-layout">
        {/* Main Stage */}
        <div className="studio-main-stage">
          <div className="stage-viewport checkerboard-bg">
            {currentResult ? (
              <img
                src={currentResult.url}
                alt="Watermarked preview"
                style={{ maxWidth: '95%', maxHeight: '65vh', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', color: '#3b82f6' }} />
                <p>Applying watermark...</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="glass-panel control-panel">
            <h3 className="control-title">Watermark Settings</h3>

            {/* Type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                className={`filter-chip ${type === 'text' ? 'active' : ''}`}
                onClick={() => setType('text')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Type size={14} />
                <span>Text Stamp</span>
              </button>
              <button
                className={`filter-chip ${type === 'logo' ? 'active' : ''}`}
                onClick={() => setType('logo')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <ImageIcon size={14} />
                <span>Logo Image</span>
              </button>
            </div>

            {type === 'text' ? (
              <>
                <div className="control-group">
                  <label className="control-label">Watermark Text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Font Size</span>
                    <span className="control-value">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="14"
                    max="100"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="control-group">
                  <label className="control-label">Text Color</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ width: '40px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['#ffffff', '#000000', '#f43f5e', '#facc15', '#38bdf8'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="control-group">
                <label className="control-label">Upload Logo (PNG)</label>
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg"
                  className="form-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setLogoFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}

            {/* Position Selector */}
            <div className="control-group">
              <label className="control-label">Position / Anchor</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <button className={`filter-chip ${position === 'top-left' ? 'active' : ''}`} onClick={() => setPosition('top-left')}>Top-Left</button>
                <button className={`filter-chip ${position === 'center' ? 'active' : ''}`} onClick={() => setPosition('center')}>Center</button>
                <button className={`filter-chip ${position === 'top-right' ? 'active' : ''}`} onClick={() => setPosition('top-right')}>Top-Right</button>
                <button className={`filter-chip ${position === 'bottom-left' ? 'active' : ''}`} onClick={() => setPosition('bottom-left')}>Bot-Left</button>
                <button className={`filter-chip ${position === 'tiled' ? 'active' : ''}`} onClick={() => setPosition('tiled')}>Tiled 🔁</button>
                <button className={`filter-chip ${position === 'bottom-right' ? 'active' : ''}`} onClick={() => setPosition('bottom-right')}>Bot-Right</button>
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="control-group">
              <div className="control-label">
                <span>Opacity</span>
                <span className="control-value">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
              />
            </div>

            {/* Rotation Slider */}
            <div className="control-group">
              <div className="control-label">
                <span>Rotation Angle</span>
                <span className="control-value">{rotation}°</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="-180"
                max="180"
                step="5"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value, 10))}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={handleApplyAll}
              disabled={isProcessing}
            >
              <RefreshCw size={16} />
              <span>{isProcessing ? 'Watermarking...' : 'Apply Watermark'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
