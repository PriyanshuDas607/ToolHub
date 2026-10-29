import React, { useState, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BatchStrip } from '../common/BatchStrip';
import { resizeImage, loadImage, fileToDataUrl } from '../../utils/imageProcessing';
import { downloadBlob, downloadAsZip } from '../../utils/zipExporter';
import { Maximize2, Download, Archive, Lock, Unlock, Percent, Hash, RefreshCw } from 'lucide-react';

export const Resizer = () => {
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState('pixels'); // 'pixels' or 'percentage'
  const [percentage, setPercentage] = useState(50);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [origRatio, setOrigRatio] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const handleFilesSelected = async (newFiles) => {
    const fileObjects = [];
    for (const file of newFiles) {
      const dataUrl = await fileToDataUrl(file);
      const img = await loadImage(dataUrl);
      fileObjects.push({
        file,
        name: file.name,
        size: file.size,
        origWidth: img.naturalWidth || img.width,
        origHeight: img.naturalHeight || img.height,
        previewUrl: dataUrl
      });
    }

    setFiles((prev) => [...prev, ...fileObjects]);

    if (files.length === 0 && fileObjects.length > 0) {
      setWidth(fileObjects[0].origWidth);
      setHeight(fileObjects[0].origHeight);
      setOrigRatio(fileObjects[0].origWidth / fileObjects[0].origHeight);
    }
  };

  const handleWidthChange = (val) => {
    const w = parseInt(val, 10) || 0;
    setWidth(w);
    if (aspectRatioLocked && origRatio) {
      setHeight(Math.round(w / origRatio));
    }
  };

  const handleHeightChange = (val) => {
    const h = parseInt(val, 10) || 0;
    setHeight(h);
    if (aspectRatioLocked && origRatio) {
      setWidth(Math.round(h * origRatio));
    }
  };

  const handleResizeAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const newResults = [];

    try {
      for (const item of files) {
        let targetW = width;
        let targetH = height;

        if (mode === 'percentage') {
          targetW = Math.round(item.origWidth * (percentage / 100));
          targetH = Math.round(item.origHeight * (percentage / 100));
        }

        const res = await resizeImage(item.file, { width: targetW, height: targetH });
        newResults.push(res);
      }
      setResults(newResults);
    } catch (err) {
      console.error('Resize error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-run whenever params change
  useEffect(() => {
    if (files.length > 0) {
      handleResizeAll();
    }
  }, [width, height, percentage, mode, files.length, activeIndex]);

  // Update original dims when active file switches
  useEffect(() => {
    if (files[activeIndex]) {
      const cur = files[activeIndex];
      const ratio = cur.origWidth / cur.origHeight;
      setOrigRatio(ratio);
      if (mode === 'pixels') {
        setWidth(cur.origWidth);
        setHeight(cur.origHeight);
      }
    }
  }, [activeIndex]);

  if (files.length === 0) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#06b6d4' }}>
              <Maximize2 size={24} />
            </div>
            <div>
              <h2 className="workspace-title">Resize Images</h2>
              <p className="workspace-subtitle">Resize by exact pixels or percentage with aspect ratio lock</p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} multiple={true} title="Drop images to resize" />
      </div>
    );
  }

  const currentFile = files[activeIndex];
  const currentResult = results[activeIndex];

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#06b6d4' }}>
            <Maximize2 size={24} />
          </div>
          <div>
            <h2 className="workspace-title">Resize Image</h2>
            <p className="workspace-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} loaded</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {results.length > 1 && (
            <button className="btn btn-secondary" onClick={() => downloadAsZip(results, 'resized_images.zip')}>
              <Archive size={16} />
              <span>Download All as ZIP</span>
            </button>
          )}
          {currentResult && (
            <button className="btn btn-primary" onClick={() => downloadBlob(currentResult.blob, currentResult.fileName)}>
              <Download size={16} />
              <span>Download Resized</span>
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
                alt="Resized output"
                style={{ maxWidth: '95%', maxHeight: '65vh', objectFit: 'contain', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p>Resizing...</p>
              </div>
            )}
          </div>

          {currentResult && currentFile && (
            <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Original Dimensions: </span>
                <strong>{currentFile.origWidth} × {currentFile.origHeight} px</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Dimensions: </span>
                <strong style={{ color: '#06b6d4' }}>{currentResult.width} × {currentResult.height} px</strong>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="glass-panel control-panel">
            <h3 className="control-title">Resize Options</h3>

            {/* Mode Switcher */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                className={`filter-chip ${mode === 'pixels' ? 'active' : ''}`}
                onClick={() => setMode('pixels')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Hash size={14} />
                <span>By Pixels</span>
              </button>
              <button
                className={`filter-chip ${mode === 'percentage' ? 'active' : ''}`}
                onClick={() => setMode('percentage')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Percent size={14} />
                <span>By Percent</span>
              </button>
            </div>

            {mode === 'pixels' ? (
              <>
                <div className="control-group">
                  <label className="control-label">Width (px)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={width}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    min="1"
                    max="10000"
                  />
                </div>

                <div className="control-group">
                  <label className="control-label">Height (px)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={height}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    min="1"
                    max="10000"
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <button
                    className={`btn ${aspectRatioLocked ? 'btn-secondary' : 'btn-danger'}`}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                    onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                  >
                    {aspectRatioLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    <span>{aspectRatioLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="control-group">
                  <div className="control-label">
                    <span>Scale Percentage</span>
                    <span className="control-value">{percentage}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="10"
                    max="200"
                    step="5"
                    value={percentage}
                    onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '1.5rem' }}>
                  {[25, 50, 75, 150].map((pct) => (
                    <button
                      key={pct}
                      className={`filter-chip ${percentage === pct ? 'active' : ''}`}
                      onClick={() => setPercentage(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={handleResizeAll}
              disabled={isProcessing}
            >
              <RefreshCw size={16} />
              <span>{isProcessing ? 'Resizing...' : 'Apply Resize'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
