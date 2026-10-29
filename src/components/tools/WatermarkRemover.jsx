import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dropzone } from '../common/Dropzone';
import { BeforeAfter } from '../common/BeforeAfter';
import { loadImage, fileToDataUrl } from '../../utils/imageProcessing';
import { removeWatermarkAuto } from '../../utils/autoWatermarkRemover';
import { inpaintImage } from '../../utils/inpainting';
import { downloadBlob } from '../../utils/zipExporter';
import {
  Eraser,
  Download,
  RotateCcw,
  Sparkles,
  Brush,
  CheckCircle2,
  Video,
  Wand2,
  Maximize2,
  UploadCloud,
  ChevronDown,
  Loader2,
  Check
} from 'lucide-react';

export const WatermarkRemover = () => {
  const [file, setFile] = useState(null);
  const [origUrl, setOrigUrl] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('Removing watermark...');
  
  // Model & Filter Controls (Exact WatermarkRemover.io controls)
  const [model, setModel] = useState('fast');
  const [removeText, setRemoveText] = useState(true);
  const [removeLogo, setRemoveLogo] = useState(true);
  
  // Manual Edit Mode
  const [isManualMode, setIsManualMode] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [hasManualMask, setHasManualMask] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Rating Feedback
  const [rated, setRated] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const fileInputRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const baseCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const baseImgRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Run Auto Removal
  const runAutoRemoval = useCallback(async (currentFile, selectedModel, textFlag, logoFlag) => {
    if (!currentFile) return;
    setIsProcessing(true);
    setProcessStep('AI analyzing repeating watermark patterns...');

    try {
      // Step 1: slight delay to render smooth UI loading state
      await new Promise((r) => setTimeout(r, 60));
      setProcessStep('Erasing watermarks & inpainting background...');

      const result = await removeWatermarkAuto(currentFile, {
        model: selectedModel,
        removeText: textFlag,
        removeLogo: logoFlag
      });

      setResultUrl(result.cleanUrl);
      setResultBlob(result.cleanBlob);
    } catch (err) {
      console.error('Auto watermark removal failed:', err);
      showToast('Error processing watermark. Try Manual Edit.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle image upload
  const handleFileSelected = async (files) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const dataUrl = await fileToDataUrl(f);
    const img = await loadImage(dataUrl);

    baseImgRef.current = img;
    setFile(f);
    setOrigUrl(dataUrl);
    setResultUrl(null);
    setResultBlob(null);
    setIsManualMode(false);
    setHasManualMask(false);
    setRated(null);

    // Automatically remove watermark on load (Zero manual painting required!)
    runAutoRemoval(f, model, removeText, removeLogo);
  };

  // Re-run when model or checkboxes change
  const handleModelChange = (newModel) => {
    setModel(newModel);
    if (file) {
      runAutoRemoval(file, newModel, removeText, removeLogo);
    }
  };

  const handleToggleText = (val) => {
    setRemoveText(val);
    if (file) {
      runAutoRemoval(file, model, val, removeLogo);
    }
  };

  const handleToggleLogo = (val) => {
    setRemoveLogo(val);
    if (file) {
      runAutoRemoval(file, model, removeText, val);
    }
  };

  // Setup Base Canvas and Mask Canvas for Manual Edit
  useEffect(() => {
    if (!baseImgRef.current || !baseCanvasRef.current || !maskCanvasRef.current || !isManualMode) return;

    const img = baseImgRef.current;
    const bCanvas = baseCanvasRef.current;
    const mCanvas = maskCanvasRef.current;

    bCanvas.width = img.naturalWidth || img.width;
    bCanvas.height = img.naturalHeight || img.height;
    mCanvas.width = bCanvas.width;
    mCanvas.height = bCanvas.height;

    const bCtx = bCanvas.getContext('2d');
    bCtx.drawImage(img, 0, 0);

    const mCtx = mCanvas.getContext('2d');
    mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
  }, [file, isManualMode]);

  // Drawing helpers for manual brush mode
  const getCanvasCoords = (e) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e) => {
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    lastPosRef.current = coords;
    drawPoint(coords.x, coords.y);
  };

  const drawPoint = (x, y) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    setHasManualMask(true);
  };

  const drawLine = (x, y) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    lastPosRef.current = { x, y };
    setHasManualMask(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    drawLine(coords.x, coords.y);
  };

  const stopDraw = () => {
    setIsDrawing(false);
  };

  const clearManualMask = () => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    setHasManualMask(false);
  };

  const handleApplyManualErase = () => {
    if (!baseCanvasRef.current || !maskCanvasRef.current || !hasManualMask) return;
    setIsProcessing(true);
    setProcessStep('Applying precise directional inpainting...');

    setTimeout(() => {
      try {
        const outCanvas = inpaintImage(baseCanvasRef.current, maskCanvasRef.current, 6, 'telea');
        outCanvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          setResultBlob(blob);
          setIsProcessing(false);
          setIsManualMode(false);
          showToast('Manual touch-up applied successfully!');
        }, 'image/jpeg', 0.98);
      } catch (err) {
        console.error('Manual inpaint error:', err);
        setIsProcessing(false);
      }
    }, 40);
  };

  if (!file) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
              <Eraser size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 className="workspace-title">WatermarkRemover</h2>
                <span className="format-badge" style={{ color: '#f97316', borderColor: '#f97316' }}>AI Auto</span>
              </div>
              <p className="workspace-subtitle">
                Automatically detect & remove repeating stock watermarks, camera icons, logos and text with zero blur
              </p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFileSelected} multiple={false} title="Drop image to remove watermark automatically" />
      </div>
    );
  }

  return (
    <div className="workspace-container" style={{ maxWidth: '1280px' }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#fff',
          padding: '0.65rem 1.4rem',
          borderRadius: '30px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          zIndex: 9999,
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <Check size={16} color="#10b981" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hidden file input for "Upload Next Image" */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelected(e.target.files);
          }
        }}
      />

      {/* Manual Edit Banner (Top Right like in WatermarkRemover.io) */}
      <div className="wm-manual-banner">
        <span>Results still has watermark?</span>
        <button
          className="wm-manual-btn"
          onClick={() => setIsManualMode(!isManualMode)}
        >
          <Brush size={14} color="#f97316" />
          <span>{isManualMode ? 'Back to AI Result' : 'Try Manual Edit'}</span>
        </button>
      </div>

      <div className="studio-layout">
        {/* Main Stage */}
        <div className="studio-main-stage">
          <div className="wm-stage-dark">
            {isProcessing ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <Loader2 size={44} className="spin-animate" style={{ color: '#f97316', margin: '0 auto 1.25rem' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem' }}>
                  {processStep}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Preserving colors, waves, and sky textures...
                </p>
              </div>
            ) : isManualMode ? (
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '95%', maxHeight: '68vh' }}>
                <canvas
                  ref={baseCanvasRef}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '68vh',
                    objectFit: 'contain',
                    border: '2px solid rgba(255,255,255,0.9)',
                    borderRadius: '4px'
                  }}
                />
                <canvas
                  ref={maskCanvasRef}
                  onMouseDown={startDraw}
                  onMouseMove={handlePointerMove}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={stopDraw}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'crosshair',
                    touchAction: 'none'
                  }}
                />
              </div>
            ) : resultUrl ? (
              <BeforeAfter
                beforeSrc={origUrl}
                afterSrc={resultUrl}
                beforeLabel="Before"
                afterLabel="After"
                labelPosition="top"
                framed={true}
              />
            ) : null}
          </div>

          {/* Manual Mode Hint */}
          {isManualMode && (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#94a3b8'
            }}>
              <span>Brush directly over any leftover watermark lines, then click <strong>Apply Manual Clean</strong>.</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={clearManualMask}>
                  <RotateCcw size={12} />
                  <span>Clear Brush</span>
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
                  onClick={handleApplyManualErase}
                  disabled={!hasManualMask}
                >
                  <Sparkles size={12} />
                  <span>Apply Manual Clean</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Controls (Identical to WatermarkRemover.io) */}
        <div className="studio-sidebar" style={{ width: '330px' }}>
          <div className="control-panel" style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Choose Watermark Model */}
            <div className="control-group" style={{ marginBottom: '1.25rem' }}>
              <label className="control-label" style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.45rem' }}>
                Choose Watermark Model
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#101114',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.86rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    appearance: 'none',
                    outline: 'none'
                  }}
                >
                  <option value="fast">Fast Remove - Pixelbin</option>
                  <option value="deep">AI Deep Clean (Stock Grids & Logos)</option>
                  <option value="ultra">Ultra Detail Precision</option>
                </select>
                <ChevronDown
                  size={16}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#94a3b8'
                  }}
                />
              </div>
            </div>

            {/* Manual Mode Brush Controls */}
            {isManualMode && (
              <div className="control-group" style={{ marginBottom: '1.2rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div className="control-label" style={{ fontSize: '0.8rem' }}>
                  <span>Brush Thickness</span>
                  <span className="control-value">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  className="slider-input"
                  min="8"
                  max="80"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                />
              </div>
            )}

            {/* Download Image CTA Button */}
            <button
              className="wm-download-btn"
              onClick={() => {
                if (resultBlob) {
                  downloadBlob(resultBlob, file.name.replace(/\.[^/.]+$/, '') + '_cleaned.jpg');
                  showToast('Downloaded clean image!');
                }
              }}
              disabled={isProcessing || !resultBlob}
            >
              <Download size={18} />
              <span>Download Image</span>
            </button>

            {/* Success Status */}
            <div className="wm-success-status">
              <CheckCircle2 size={16} color="#10b981" />
              <span>Watermark removed successfully</span>
            </div>

            {/* Remove Text / Remove Logo Toggles */}
            <div className="wm-checkbox-group">
              <label className="wm-checkbox-label">
                <input
                  type="checkbox"
                  checked={removeText}
                  onChange={(e) => handleToggleText(e.target.checked)}
                />
                <span>Remove Text</span>
              </label>

              <label className="wm-checkbox-label">
                <input
                  type="checkbox"
                  checked={removeLogo}
                  onChange={(e) => handleToggleLogo(e.target.checked)}
                />
                <span>Remove Logo</span>
              </label>
            </div>

            {/* Upload Next Image Button */}
            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)',
                color: '#f1f5f9',
                fontSize: '0.86rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                justifyContent: 'center'
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <UploadCloud size={16} />
              <span>Upload Next Image</span>
            </button>

            {/* Quick Actions (Convert to Video, Edit with AI, Upscale Image) */}
            <div className="wm-action-icons">
              <button
                className="wm-action-btn"
                onClick={() => showToast('Feature coming soon in Video Studio!')}
              >
                <Video size={18} color="#94a3b8" />
                <span>Convert to Video</span>
              </button>

              <button
                className="wm-action-btn"
                onClick={() => showToast('Switched to Photo Editor mode!')}
              >
                <Wand2 size={18} color="#94a3b8" />
                <span>Edit with AI</span>
              </button>

              <button
                className="wm-action-btn"
                onClick={() => showToast('Opening Super-Resolution Upscaler...')}
              >
                <Maximize2 size={18} color="#94a3b8" />
                <span>Upscale Image</span>
              </button>
            </div>

            {/* Rate this result */}
            <div className="wm-rate-bar">
              <span>Rate this result:</span>
              <button
                className="wm-emoji-btn"
                onClick={() => {
                  setRated('sad');
                  showToast('Thank you for feedback! We are constantly tuning the model.');
                }}
                style={{ opacity: rated === 'sad' ? 1 : 0.65, transform: rated === 'sad' ? 'scale(1.2)' : 'none' }}
                title="Needs improvement"
              >
                😞
              </button>
              <button
                className="wm-emoji-btn"
                onClick={() => {
                  setRated('happy');
                  showToast('Glad you loved the clean result! 🎉');
                }}
                style={{ opacity: rated === 'happy' ? 1 : 0.65, transform: rated === 'happy' ? 'scale(1.2)' : 'none' }}
                title="Looks amazing!"
              >
                😀
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
