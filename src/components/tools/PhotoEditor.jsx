import React, { useState, useRef, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { loadImage, fileToDataUrl } from '../../utils/imageProcessing';
import { downloadBlob } from '../../utils/zipExporter';
import { 
  Palette, 
  RotateCcw, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  Type, 
  Stamp, 
  Download, 
  Undo, 
  Sliders, 
  Sparkles,
  Crop,
  Check
} from 'lucide-react';

const PRESET_FILTERS = [
  { id: 'normal', name: 'Normal (Raw)', filter: '' },
  { id: 'vintage', name: 'Vintage Tone', filter: 'sepia(40%) contrast(108%) brightness(96%) saturate(120%)' },
  { id: 'cyberpunk', name: 'High Contrast', filter: 'contrast(135%) saturate(140%) brightness(102%)' },
  { id: 'noir', name: 'Film Noir B&W', filter: 'grayscale(100%) contrast(150%) brightness(92%)' },
  { id: 'sunset', name: 'Warm Daylight', filter: 'sepia(20%) saturate(140%) brightness(105%)' },
  { id: 'cool', name: 'Cool Slate', filter: 'hue-rotate(180deg) saturate(90%) contrast(110%)' },
];

const PRO_STAMPS = ['APPROVED', 'DRAFT', 'CONFIDENTIAL', 'FINAL', 'SAMPLE', 'COPYRIGHT', 'OFFICIAL', 'VERIFIED'];

export const PhotoEditor = () => {
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState('adjust'); // 'adjust', 'filters', 'transform', 'text', 'stamps'

  // Adjustments
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);

  // Transforms
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Filter Preset
  const [activeFilter, setActiveFilter] = useState('normal');

  // Text & Stamp Overlays
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(32);
  const [overlays, setOverlays] = useState([]); // Array of { type: 'text'|'stamp', content, x, y, size, color }

  const canvasRef = useRef(null);
  const baseImgRef = useRef(null);

  const handleFileSelected = async (files) => {
    if (files.length === 0) return;
    const f = files[0];
    const dataUrl = await fileToDataUrl(f);
    const img = await loadImage(dataUrl);
    baseImgRef.current = img;
    setFile(f);
    resetAll();
  };

  const resetAll = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setSepia(0);
    setGrayscale(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setActiveFilter('normal');
    setOverlays([]);
  };

  // Re-render canvas whenever any attribute changes
  useEffect(() => {
    if (!baseImgRef.current || !canvasRef.current) return;

    const img = baseImgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Handle 90 deg canvas dimensions swap
    const isRotatedSideways = rotation === 90 || rotation === 270;
    const targetW = isRotatedSideways ? img.naturalHeight || img.height : img.naturalWidth || img.width;
    const targetH = isRotatedSideways ? img.naturalWidth || img.width : img.naturalHeight || img.height;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.save();

    // Coordinate space transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Build CSS filters
    const presetObj = PRESET_FILTERS.find((p) => p.id === activeFilter);
    const presetStr = presetObj?.filter || '';
    const manualStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) sepia(${sepia}%) grayscale(${grayscale}%)`;

    ctx.filter = `${presetStr} ${manualStr}`.trim();

    // Draw base image centered
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    ctx.drawImage(img, -origW / 2, -origH / 2, origW, origH);

    ctx.restore();

    // Draw Text & Professional Stamps on top
    overlays.forEach((item) => {
      ctx.save();
      if (item.type === 'text') {
        ctx.font = `bold ${item.size}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = item.color;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.content, item.x, item.y);
      } else if (item.type === 'stamp') {
        // Draw crisp border stamp badge
        ctx.font = `bold ${item.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        const textMetrics = ctx.measureText(item.content);
        const padX = 18;
        const padY = 10;
        ctx.strokeRect(
          item.x - textMetrics.width / 2 - padX,
          item.y - item.size / 2 - padY,
          textMetrics.width + padX * 2,
          item.size + padY * 2
        );
        ctx.fillText(item.content, item.x, item.y);
      }
      ctx.restore();
    });
  }, [file, brightness, contrast, saturation, blur, sepia, grayscale, rotation, flipH, flipV, activeFilter, overlays]);

  const handleAddText = () => {
    if (!textInput.trim() || !canvasRef.current) return;
    setOverlays((prev) => [
      ...prev,
      {
        type: 'text',
        content: textInput,
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
        size: textSize,
        color: textColor
      }
    ]);
    setTextInput('');
  };

  const handleAddStamp = (stampText) => {
    if (!canvasRef.current) return;
    setOverlays((prev) => [
      ...prev,
      {
        type: 'stamp',
        content: stampText,
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
        size: 36
      }
    ]);
  };

  const handleExport = (format = 'image/png') => {
    if (!canvasRef.current || !file) return;
    canvasRef.current.toBlob((blob) => {
      const ext = format === 'image/jpeg' ? 'jpg' : 'png';
      const name = file.name.replace(/\.[^/.]+$/, '') + `_edited.${ext}`;
      downloadBlob(blob, name);
    }, format, 0.95);
  };

  if (!file) {
    return (
      <div className="workspace-container">
        <div className="workspace-header">
          <div className="workspace-title-box">
            <div className="workspace-icon" style={{ backgroundColor: '#eab308' }}>
              <Palette size={22} />
            </div>
            <div>
              <h2 className="workspace-title">Photo Editor Studio</h2>
              <p className="workspace-subtitle">Adjust lighting, filters, rotation, stamps and text overlays</p>
            </div>
          </div>
        </div>
        <Dropzone onFilesSelected={handleFileSelected} multiple={false} title="Drop an image to open Photo Studio" />
      </div>
    );
  }

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#eab308' }}>
            <Palette size={22} />
          </div>
          <div>
            <h2 className="workspace-title">Photo Editor Studio</h2>
            <p className="workspace-subtitle">{file.name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary" onClick={resetAll}>
            <Undo size={15} />
            <span>Reset All</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleExport('image/png')}>
            <Download size={15} />
            <span>Save & Export PNG</span>
          </button>
        </div>
      </div>

      <div className="studio-layout">
        {/* Stage Canvas */}
        <div className="studio-main-stage">
          <div className="stage-viewport checkerboard-bg">
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '95%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="studio-sidebar">
          <div className="control-panel">
            {/* Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', marginBottom: '1.25rem' }}>
              <button
                className={`filter-chip ${activeTab === 'adjust' ? 'active' : ''}`}
                onClick={() => setActiveTab('adjust')}
              >
                Adjust
              </button>
              <button
                className={`filter-chip ${activeTab === 'filters' ? 'active' : ''}`}
                onClick={() => setActiveTab('filters')}
              >
                Filters
              </button>
              <button
                className={`filter-chip ${activeTab === 'transform' ? 'active' : ''}`}
                onClick={() => setActiveTab('transform')}
              >
                Rotate
              </button>
              <button
                className={`filter-chip ${activeTab === 'stamps' ? 'active' : ''}`}
                onClick={() => setActiveTab('stamps')}
              >
                Stamps
              </button>
            </div>

            {/* TAB 1: ADJUSTMENTS */}
            {activeTab === 'adjust' && (
              <div>
                <div className="control-group">
                  <div className="control-label">
                    <span>Brightness</span>
                    <span className="control-value">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="20"
                    max="200"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Contrast</span>
                    <span className="control-value">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="20"
                    max="200"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Saturation</span>
                    <span className="control-value">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="0"
                    max="200"
                    value={saturation}
                    onChange={(e) => setSaturation(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Blur</span>
                    <span className="control-value">{blur}px</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="0"
                    max="20"
                    value={blur}
                    onChange={(e) => setBlur(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="control-group">
                  <div className="control-label">
                    <span>Sepia Tone</span>
                    <span className="control-value">{sepia}%</span>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min="0"
                    max="100"
                    value={sepia}
                    onChange={(e) => setSepia(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: FILTERS */}
            {activeTab === 'filters' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {PRESET_FILTERS.map((p) => (
                  <button
                    key={p.id}
                    className={`btn ${activeFilter === p.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.775rem', padding: '0.65rem 0.4rem' }}
                    onClick={() => setActiveFilter(p.id)}
                  >
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* TAB 3: TRANSFORM */}
            {activeTab === 'transform' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                  >
                    <RotateCcw size={15} />
                    <span>Rotate Left</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  >
                    <RotateCw size={15} />
                    <span>Rotate Right</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className={`btn ${flipH ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFlipH(!flipH)}
                  >
                    <FlipHorizontal size={15} />
                    <span>Flip Horiz</span>
                  </button>
                  <button
                    className={`btn ${flipV ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFlipV(!flipV)}
                  >
                    <FlipVertical size={15} />
                    <span>Flip Vert</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: TEXT & PRO STAMPS */}
            {activeTab === 'stamps' && (
              <div>
                <div className="control-group">
                  <label className="control-label">Add Custom Text</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter text..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    style={{ marginBottom: '0.4rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      style={{ width: '36px', height: '34px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                      min="12"
                      max="120"
                      style={{ width: '70px' }}
                    />
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddText}>
                      <Type size={13} />
                      <span>Insert</span>
                    </button>
                  </div>
                </div>

                <div className="control-group" style={{ marginTop: '1rem' }}>
                  <label className="control-label">Document & Photo Stamps</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {PRO_STAMPS.map((stampText, idx) => (
                      <button
                        key={idx}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.725rem', padding: '0.45rem', fontFamily: 'monospace' }}
                        onClick={() => handleAddStamp(stampText)}
                      >
                        <Stamp size={12} />
                        <span>{stampText}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {overlays.length > 0 && (
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={() => setOverlays([])}
                  >
                    Clear All Stamps ({overlays.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
