import React, { useState, useEffect, useRef } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BatchStrip } from '../common/BatchStrip';
import { BeforeAfter } from '../common/BeforeAfter';
import { 
  removeBackgroundAI, 
  removeBackgroundSaliency, 
  compositeBackdrop 
} from '../../utils/bgRemover';
import { downloadBlob, downloadAsZip } from '../../utils/zipExporter';
import { 
  Wand2, 
  Download, 
  Archive, 
  RefreshCw, 
  Palette, 
  Layers, 
  FlipHorizontal2,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const BgRemover = () => {
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tolerance, setTolerance] = useState(38);
  const [invert, setInvert] = useState(false);
  const [backdrop, setBackdrop] = useState('transparent'); // 'transparent', 'color', 'gradient'
  const [customBgColor, setCustomBgColor] = useState('#ffffff');
  const [engine, setEngine] = useState('ai'); // 'ai' or 'saliency'
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState('');
  const [results, setResults] = useState([]);
  const [rawCutoutBlobs, setRawCutoutBlobs] = useState([]); // Store raw transparent PNG blobs

  const handleFilesSelected = (newFiles) => {
    const fileObjects = newFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file)
    }));
    setFiles((prev) => [...prev, ...fileObjects]);
  };

  const processImage = async (fileObj, index) => {
    setIsProcessing(true);
    setProgressInfo('Analyzing image subjects...');

    try {
      let cutoutBlob = null;

      if (engine === 'ai') {
        try {
          setProgressInfo('Running Neural Segmentation Model...');
          cutoutBlob = await removeBackgroundAI(fileObj.file, ({ stage, percent }) => {
            setProgressInfo(`AI Model ${stage}: ${percent}%`);
          });
        } catch (aiErr) {
          console.warn('Falling back to smart saliency matting:', aiErr);
          setProgressInfo('Refining edges with smart matting...');
          cutoutBlob = await removeBackgroundSaliency(fileObj.file, { tolerance, invert });
        }
      } else {
        setProgressInfo('Processing saliency mask...');
        cutoutBlob = await removeBackgroundSaliency(fileObj.file, { tolerance, invert });
      }

      setRawCutoutBlobs((prev) => {
        const next = [...prev];
        next[index] = cutoutBlob;
        return next;
      });

      // Composite backdrop
      const finalResult = await compositeBackdrop(cutoutBlob, { backdrop, customBgColor });
      finalResult.fileName = fileObj.name.replace(/\.[^/.]+$/, '') + `_cutout.png`;

      setResults((prev) => {
        const next = [...prev];
        next[index] = finalResult;
        return next;
      });
    } catch (err) {
      console.error('Background removal failed:', err);
    } finally {
      setIsProcessing(false);
      setProgressInfo('');
    }
  };

  // Re-run composite when backdrop changes (instant without re-segmenting!)
  useEffect(() => {
    const currentCutout = rawCutoutBlobs[activeIndex];
    if (currentCutout && files[activeIndex]) {
      compositeBackdrop(currentCutout, { backdrop, customBgColor }).then((res) => {
        res.fileName = files[activeIndex].name.replace(/\.[^/.]+$/, '') + `_cutout.png`;
        setResults((prev) => {
          const next = [...prev];
          next[activeIndex] = res;
          return next;
        });
      });
    }
  }, [backdrop, customBgColor]);

  // Run segmentation when active file, engine, tolerance, or invert changes
  useEffect(() => {
    if (files.length > 0 && files[activeIndex]) {
      processImage(files[activeIndex], activeIndex);
    }
  }, [activeIndex, engine, tolerance, invert, files.length]);

  if (files.length === 0) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#ec4899' }}>
              <Wand2 size={22} />
            </div>
            <div>
              <h2 className="workspace-title">AI Background Remover</h2>
              <p className="workspace-subtitle">
                Accurately cut out people, products, and objects with neural AI and transparent PNG export
              </p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFilesSelected} multiple={true} title="Drop images to remove background" />
      </div>
    );
  }

  const currentFile = files[activeIndex];
  const currentResult = results[activeIndex];

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#ec4899' }}>
            <Wand2 size={22} />
          </div>
          <div>
            <h2 className="workspace-title">AI Background Remover</h2>
            <p className="workspace-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} in workspace</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {results.filter(Boolean).length > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => downloadAsZip(results.filter(Boolean), 'cutout_images.zip')}
            >
              <Archive size={15} />
              <span>Download All as ZIP</span>
            </button>
          )}

          {currentResult && (
            <button
              className="btn btn-primary"
              onClick={() => downloadBlob(currentResult.blob, currentResult.fileName)}
            >
              <Download size={15} />
              <span>Download Cutout PNG</span>
            </button>
          )}
        </div>
      </div>

      {/* Batch Strip */}
      <BatchStrip
        files={files.map((f, i) => ({ ...f, processed: !!results[i] }))}
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onRemoveFile={(idx) => {
          setFiles((prev) => prev.filter((_, i) => i !== idx));
          setResults((prev) => prev.filter((_, i) => i !== idx));
          setRawCutoutBlobs((prev) => prev.filter((_, i) => i !== idx));
        }}
        onAddFiles={handleFilesSelected}
      />

      {/* Studio Stage */}
      <div className="studio-layout">
        <div className="studio-main-stage">
          <div className="stage-viewport checkerboard-bg">
            {isProcessing ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#ec4899' }} />
                <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {progressInfo || 'Analyzing & Segmenting Subject...'}
                </p>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Deep neural networks are isolating edges in real-time
                </span>
              </div>
            ) : currentResult && currentFile ? (
              <BeforeAfter
                beforeSrc={currentFile.previewUrl}
                afterSrc={currentResult.url}
                beforeLabel="Original Photo"
                afterLabel={backdrop === 'transparent' ? 'Transparent PNG' : 'Replaced Backdrop'}
              />
            ) : null}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="control-panel">
            <h3 className="control-title">
              <span>Segmentation Controls</span>
              <span className="format-badge" style={{ color: '#ec4899' }}>AI Active</span>
            </h3>

            {/* Engine Selector */}
            <div className="control-group">
              <label className="control-label">AI Segmentation Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button
                  className={`btn ${engine === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                  onClick={() => setEngine('ai')}
                >
                  <Sparkles size={13} />
                  <span>Deep Neural AI</span>
                </button>
                <button
                  className={`btn ${engine === 'saliency' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                  onClick={() => setEngine('saliency')}
                >
                  <Sliders size={13} />
                  <span>Saliency Edge</span>
                </button>
              </div>
            </div>

            {/* Invert Subject / Background Toggle */}
            <div className="control-group">
              <button
                className={`btn ${invert ? 'btn-danger' : 'btn-secondary'}`}
                style={{ width: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                onClick={() => setInvert(!invert)}
              >
                <FlipHorizontal2 size={14} />
                <span>{invert ? 'Mask Inverted (Subject Removed)' : 'Normal Mask (Background Removed)'}</span>
              </button>
            </div>

            {/* Tolerance Slider for Saliency mode */}
            {engine === 'saliency' && (
              <div className="control-group">
                <div className="control-label">
                  <span>Edge Threshold</span>
                  <span className="control-value">{tolerance}%</span>
                </div>
                <input
                  type="range"
                  className="slider-input"
                  min="15"
                  max="80"
                  value={tolerance}
                  onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                />
              </div>
            )}

            {/* Backdrop Replacement */}
            <div className="control-group">
              <label className="control-label">Backdrop Replacement</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <button
                  className={`filter-chip ${backdrop === 'transparent' ? 'active' : ''}`}
                  onClick={() => setBackdrop('transparent')}
                >
                  Transparent
                </button>
                <button
                  className={`filter-chip ${backdrop === 'color' ? 'active' : ''}`}
                  onClick={() => setBackdrop('color')}
                >
                  Solid Color
                </button>
                <button
                  className={`filter-chip ${backdrop === 'gradient' ? 'active' : ''}`}
                  onClick={() => setBackdrop('gradient')}
                >
                  Gradient
                </button>
              </div>

              {backdrop === 'color' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    style={{ width: '38px', height: '34px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                  />
                  <div style={{ display: 'flex', gap: '0.35rem', flex: 1 }}>
                    {['#ffffff', '#000000', '#f8fafc', '#ef4444', '#3b82f6', '#10b981'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCustomBgColor(c)}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Re-process Button */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              onClick={() => processImage(currentFile, activeIndex)}
              disabled={isProcessing}
            >
              <RefreshCw size={15} className={isProcessing ? 'animate-spin' : ''} />
              <span>{isProcessing ? 'Processing AI...' : 'Re-apply Segmentation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
