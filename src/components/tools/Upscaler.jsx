import React, { useState, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BatchStrip } from '../common/BatchStrip';
import { BeforeAfter } from '../common/BeforeAfter';
import { upscaleImage } from '../../utils/upscaler';
import { downloadBlob, downloadAsZip } from '../../utils/zipExporter';
import { Sparkles, Download, Archive, RefreshCw, Zap } from 'lucide-react';

export const Upscaler = () => {
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scale, setScale] = useState(2); // 2 or 4
  const [sharpness, setSharpness] = useState(1.5);
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

  const handleUpscaleCurrent = async () => {
    if (!files[activeIndex]) return;
    setIsProcessing(true);
    try {
      const res = await upscaleImage(files[activeIndex].file, { scale, sharpness });
      setResults((prev) => {
        const next = [...prev];
        next[activeIndex] = res;
        return next;
      });
    } catch (err) {
      console.error('Upscale error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpscaleAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const newResults = [];
    try {
      for (const item of files) {
        const res = await upscaleImage(item.file, { scale, sharpness });
        newResults.push(res);
      }
      setResults(newResults);
    } catch (err) {
      console.error('Batch upscale error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (files.length > 0 && files[activeIndex]) {
      handleUpscaleCurrent();
    }
  }, [activeIndex, scale, sharpness, files.length]);

  if (files.length === 0) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#a855f7' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="workspace-title">AI Image Upscaler</h2>
              <p className="workspace-subtitle">Upscale low-resolution photos 2x or 4x with smart detail sharpening</p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} multiple={true} title="Drop images to upscale with AI" />
      </div>
    );
  }

  const currentFile = files[activeIndex];
  const currentResult = results[activeIndex];

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#a855f7' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="workspace-title">AI Image Upscaler</h2>
            <p className="workspace-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} loaded</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {results.filter(Boolean).length > 1 && (
            <button className="btn btn-secondary" onClick={() => downloadAsZip(results.filter(Boolean), 'upscaled_images.zip')}>
              <Archive size={16} />
              <span>Download All as ZIP</span>
            </button>
          )}
          {currentResult && (
            <button className="btn btn-primary" onClick={() => downloadBlob(currentResult.blob, currentResult.fileName)}>
              <Download size={16} />
              <span>Download {scale}x Upscaled</span>
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
          <div className="stage-viewport">
            {isProcessing ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', color: '#a855f7' }} />
                <p style={{ fontWeight: 600 }}>Upscaling with AI sharpening filters...</p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Generating {scale}x high-definition pixels</span>
              </div>
            ) : currentResult && currentFile ? (
              <BeforeAfter
                beforeSrc={currentFile.previewUrl}
                afterSrc={currentResult.url}
                beforeLabel={`Original (${currentResult.originalWidth} × ${currentResult.originalHeight})`}
                afterLabel={`Upscaled ${scale}x (${currentResult.upscaledWidth} × ${currentResult.upscaledHeight})`}
              />
            ) : null}
          </div>

          {currentResult && (
            <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Original Resolution: </span>
                <strong>{currentResult.originalWidth} × {currentResult.originalHeight}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7', fontWeight: 700 }}>
                <Zap size={16} />
                <span>{scale}x Super Resolution Active</span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upscaled Resolution: </span>
                <strong style={{ color: '#a855f7' }}>{currentResult.upscaledWidth} × {currentResult.upscaledHeight}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="glass-panel control-panel">
            <h3 className="control-title">AI Upscaling Model</h3>

            <div className="control-group">
              <label className="control-label">Scale Factor</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  className={`btn ${scale === 2 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setScale(2)}
                >
                  <Sparkles size={16} />
                  <span>2x Upscale</span>
                </button>
                <button
                  className={`btn ${scale === 4 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setScale(4)}
                >
                  <Zap size={16} />
                  <span>4x Ultra HD</span>
                </button>
              </div>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span>Contrast-Adaptive Sharpness</span>
                <span className="control-value">{Math.round(sharpness * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0.5"
                max="3.0"
                step="0.1"
                value={sharpness}
                onChange={(e) => setSharpness(parseFloat(e.target.value))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '1.5rem' }}>
              <button className={`filter-chip ${sharpness === 0.8 ? 'active' : ''}`} onClick={() => setSharpness(0.8)}>
                Natural
              </button>
              <button className={`filter-chip ${sharpness === 1.5 ? 'active' : ''}`} onClick={() => setSharpness(1.5)}>
                Balanced
              </button>
              <button className={`filter-chip ${sharpness === 2.4 ? 'active' : ''}`} onClick={() => setSharpness(2.4)}>
                Ultra Crisp
              </button>
            </div>

            {files.length > 1 && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '0.75rem' }}
                onClick={handleUpscaleAll}
                disabled={isProcessing}
              >
                <span>Upscale All {files.length} Images</span>
              </button>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={handleUpscaleCurrent}
              disabled={isProcessing}
            >
              <RefreshCw size={16} />
              <span>{isProcessing ? 'Processing AI...' : 'Re-apply Enhancer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
