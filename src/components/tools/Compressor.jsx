import React, { useState, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BatchStrip } from '../common/BatchStrip';
import { BeforeAfter } from '../common/BeforeAfter';
import { compressImage, formatBytes } from '../../utils/imageProcessing';
import { downloadBlob, downloadAsZip } from '../../utils/zipExporter';
import { Minimize2, Download, Archive, Sparkles, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';

export const Compressor = () => {
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quality, setQuality] = useState(0.75);
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

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults((prev) => prev.filter((_, i) => i !== index));
    if (activeIndex >= index && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleCompressAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const newResults = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const res = await compressImage(files[i].file, quality);
        newResults.push(res);
      }
      setResults(newResults);
    } catch (err) {
      console.error('Compression error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-run compression for active file when quality changes
  useEffect(() => {
    if (files.length > 0) {
      handleCompressAll();
    }
  }, [quality, files.length]);

  if (files.length === 0) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#f43f5e' }}>
              <Minimize2 size={24} />
            </div>
            <div>
              <h2 className="workspace-title">Compress Image</h2>
              <p className="workspace-subtitle">Reduce image file size with maximum quality retention</p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} multiple={true} title="Drop images to compress" />
      </div>
    );
  }

  const currentFile = files[activeIndex];
  const currentResult = results[activeIndex];

  const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalCompressedSize = results.reduce((acc, r) => acc + (r.compressedSize || 0), 0);
  const totalSavedPercent = totalOriginalSize > 0 && totalCompressedSize > 0 
    ? Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100) 
    : 0;

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#f43f5e' }}>
            <Minimize2 size={24} />
          </div>
          <div>
            <h2 className="workspace-title">Compress Images</h2>
            <p className="workspace-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} loaded</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {results.length > 1 && (
            <button className="btn btn-secondary" onClick={() => downloadAsZip(results, 'compressed_images.zip')}>
              <Archive size={16} />
              <span>Download All as ZIP</span>
            </button>
          )}
          {currentResult && (
            <button className="btn btn-primary" onClick={() => downloadBlob(currentResult.blob, currentResult.fileName)}>
              <Download size={16} />
              <span>Download Image</span>
            </button>
          )}
        </div>
      </div>

      <BatchStrip
        files={files.map((f, i) => ({ ...f, processed: !!results[i] }))}
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onRemoveFile={handleRemoveFile}
        onAddFiles={handleFilesSelected}
      />

      <div className="studio-layout">
        {/* Main Comparison Area */}
        <div className="studio-main-stage">
          <div className="stage-viewport">
            {currentFile && currentResult ? (
              <BeforeAfter
                beforeSrc={currentFile.previewUrl}
                afterSrc={currentResult.url}
                beforeLabel={`Original: ${formatBytes(currentFile.size)}`}
                afterLabel={`Compressed: ${formatBytes(currentResult.compressedSize)} (-${currentResult.savedPercent}%)`}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', animation: 'spin 1s linear infinite' }} />
                <p>Compressing image...</p>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          {currentResult && (
            <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Original Size</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatBytes(currentResult.originalSize)}</div>
              </div>
              <ArrowRight size={20} color="var(--primary)" />
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compressed Size</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{formatBytes(currentResult.compressedSize)}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Space Saved</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f43f5e' }}>{currentResult.savedPercent}% SAVED</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="glass-panel control-panel">
            <h3 className="control-title">
              <span>Compression Level</span>
              <span className="control-value">{Math.round(quality * 100)}%</span>
            </h3>

            <div className="control-group">
              <input
                type="range"
                className="slider-input"
                min="0.1"
                max="0.95"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
              />
            </div>

            {/* Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                className={`filter-chip ${quality <= 0.4 ? 'active' : ''}`}
                onClick={() => setQuality(0.35)}
              >
                Max Size
              </button>
              <button
                className={`filter-chip ${quality > 0.4 && quality < 0.85 ? 'active' : ''}`}
                onClick={() => setQuality(0.75)}
              >
                Balanced
              </button>
              <button
                className={`filter-chip ${quality >= 0.85 ? 'active' : ''}`}
                onClick={() => setQuality(0.9)}
              >
                High Qual
              </button>
            </div>

            {/* Batch Summary */}
            {files.length > 1 && (
              <div style={{ background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Batch Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  <span>Total Original:</span>
                  <span>{formatBytes(totalOriginalSize)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  <span>Total Compressed:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{formatBytes(totalCompressedSize)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)' }}>
                  <span>Overall Saved:</span>
                  <span style={{ color: '#f43f5e' }}>{totalSavedPercent}%</span>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem' }}
              onClick={handleCompressAll}
              disabled={isProcessing}
            >
              <RefreshCw size={16} />
              <span>{isProcessing ? 'Processing...' : 'Re-compress Batch'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
