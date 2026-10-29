import React, { useState, useEffect } from 'react';
import { Dropzone } from '../common/Dropzone';
import { 
  FileText, 
  FileCode, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  ArrowRight,
  Repeat,
  Cpu
} from 'lucide-react';
import { 
  convertPdfToDocx, 
  convertDocxToPdf, 
  convertImageToDocx, 
  makePdfSearchable, 
  checkBackendStatus 
} from '../../utils/ocrEngine';

const CONVERTER_MODES = [
  {
    id: 'pdf-to-docx',
    title: 'PDF to Word (.docx)',
    subtitle: 'Extract editable text, tables, and headings into native Word document',
    icon: FileCode,
    accept: { 'application/pdf': ['.pdf'] },
    acceptText: 'PDF files',
    outputExt: '.docx',
    badge: 'Editable Word'
  },
  {
    id: 'docx-to-pdf',
    title: 'Word (.docx) to PDF',
    subtitle: '1:1 visual layout, exact margins, table widths, and clean pagination',
    icon: FileText,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    acceptText: 'Word documents (.docx, .doc)',
    outputExt: '.pdf',
    badge: 'Exact Layout'
  },
  {
    id: 'ocr-pdf',
    title: 'OCR PDF (Searchable)',
    subtitle: 'Sandwich PDF: 100% original visual layout with selectable text layer',
    icon: Sparkles,
    accept: { 'application/pdf': ['.pdf'] },
    acceptText: 'Scanned PDF files',
    outputExt: '.pdf',
    badge: 'Searchable'
  },
  {
    id: 'image-to-docx',
    title: 'Image to Word (.docx)',
    subtitle: 'Extract text and tables from photos or scans into editable Word file',
    icon: ImageIcon,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    acceptText: 'PNG, JPG, or WEBP images',
    outputExt: '.docx',
    badge: 'OCR Scanner'
  }
];

export const Converter = () => {
  const [activeMode, setActiveMode] = useState('pdf-to-docx');
  const [files, setFiles] = useState([]);
  const [language, setLanguage] = useState('eng');
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const currentMode = CONVERTER_MODES.find(m => m.id === activeMode) || CONVERTER_MODES[0];

  useEffect(() => {
    checkBackendStatus().then(status => setBackendOnline(status));
    const interval = setInterval(async () => {
      const status = await checkBackendStatus();
      setBackendOnline(status);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleFilesSelected = (newFiles) => {
    const queue = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      status: 'idle', // 'idle' | 'processing' | 'done' | 'error'
      progress: 0,
      stageMsg: 'Pending',
      downloadUrl: null,
      outputName: null,
      errorMsg: null
    }));
    setFiles(prev => [...prev, ...queue]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearQueue = () => {
    setFiles([]);
  };

  const processSingleFile = async (item) => {
    setFiles(prev => prev.map(f => f.id === item.id ? { 
      ...f, 
      status: 'processing', 
      progress: 10, 
      stageMsg: 'Starting conversion...' 
    } : f));

    const onProgress = (percent, message) => {
      setFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        progress: percent,
        stageMsg: message
      } : f));
    };

    try {
      let outputBlob = null;

      if (activeMode === 'pdf-to-docx') {
        outputBlob = await convertPdfToDocx(item.file, language, onProgress);
      } else if (activeMode === 'docx-to-pdf') {
        outputBlob = await convertDocxToPdf(item.file, onProgress);
      } else if (activeMode === 'ocr-pdf') {
        outputBlob = await makePdfSearchable(item.file, language, onProgress);
      } else if (activeMode === 'image-to-docx') {
        outputBlob = await convertImageToDocx(item.file, language, onProgress);
      }

      const downloadUrl = URL.createObjectURL(outputBlob);
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      const outputName = `${baseName}_converted${currentMode.outputExt}`;

      setFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status: 'done',
        progress: 100,
        stageMsg: 'Ready for download',
        downloadUrl,
        outputName
      } : f));
    } catch (err) {
      console.error('Conversion error:', err);
      setFiles(prev => prev.map(f => f.id === item.id ? {
        ...f,
        status: 'error',
        progress: 0,
        stageMsg: 'Failed',
        errorMsg: err.message || 'Conversion failed. Please try again.'
      } : f));
    }
  };

  const handleProcessAll = async () => {
    if (files.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const pending = files.filter(f => f.status !== 'done');
    for (const item of pending) {
      await processSingleFile(item);
    }

    setIsProcessing(false);
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div className="workspace-title-box">
          <div className="workspace-icon" style={{ backgroundColor: '#ef4444' }}>
            <Repeat size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="workspace-title">Converter</h2>
              <span className="format-badge" style={{ color: '#ef4444' }}>
                PDF & Word Engine
              </span>
            </div>
            <p className="workspace-subtitle">
              Convert PDF to editable Word, Word to PDF, and run OCR text & table recognition
            </p>
          </div>
        </div>

        {/* OCR Engine Live Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.45rem', 
              padding: '0.35rem 0.75rem', 
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}
            title={backendOnline ? 'Connected to ToolsHub Python Backend (:8000)' : 'Running client-side Tesseract OCR + WASM engine'}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span>{backendOnline ? 'OCR Backend Connected (:8000)' : 'OCR Engine Active (In-Browser)'}</span>
          </div>
        </div>
      </div>

      {/* 4 User-Friendly Mode Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {CONVERTER_MODES.map(mode => {
          const Icon = mode.icon;
          const isSelected = activeMode === mode.id;
          return (
            <div
              key={mode.id}
              onClick={() => {
                setActiveMode(mode.id);
                setFiles([]);
              }}
              style={{
                cursor: 'pointer',
                padding: '1rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                boxShadow: isSelected ? '0 4px 14px rgba(239, 68, 68, 0.15)' : 'none',
                transition: 'all 0.18s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={17} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-secondary)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {mode.title}
                  </span>
                </div>
                <span className="format-badge" style={{ fontSize: '0.65rem' }}>{mode.badge}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                {mode.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* Targeted Dropzone */}
      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept={currentMode.accept}
        title={`Drop ${currentMode.acceptText} here`}
        subtitle={`Selected: ${currentMode.title}`}
      />

      {/* Queue & Processing Actions */}
      {files.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                Files ({files.length})
              </h3>
              {(activeMode === 'pdf-to-docx' || activeMode === 'ocr-pdf' || activeMode === 'image-to-docx') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>OCR Language:</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    <option value="eng">English (Latin)</option>
                    <option value="hin">Hindi (Devanagari)</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn btn-secondary" onClick={clearQueue} disabled={isProcessing}>
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={handleProcessAll}
                disabled={isProcessing || files.length === 0}
              >
                <Sparkles size={14} />
                <span>{isProcessing ? 'Converting...' : `Convert to ${currentMode.outputExt.toUpperCase()}`}</span>
              </button>
            </div>
          </div>

          {/* List of files in queue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {files.map(item => (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.85rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                  <FileText size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      {item.size} • Output: {currentMode.outputExt.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Status & Progress bar */}
                <div style={{ flex: 1, maxWidth: '280px' }}>
                  {item.status === 'processing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        <span>{item.stageMsg}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  )}

                  {item.status === 'done' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>
                      <CheckCircle2 size={16} />
                      <span>Ready for download</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontSize: '0.75rem' }}>
                      <AlertCircle size={15} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.errorMsg}
                      </span>
                    </div>
                  )}

                  {item.status === 'idle' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Ready</span>
                  )}
                </div>

                {/* Action button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {item.status === 'done' && item.downloadUrl && (
                    <a
                      href={item.downloadUrl}
                      download={item.outputName}
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </a>
                  )}

                  {item.status === 'idle' && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={() => processSingleFile(item)}
                      disabled={isProcessing}
                    >
                      <ArrowRight size={13} />
                      <span>Convert</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.45rem' }}
                    onClick={() => removeFile(item.id)}
                    disabled={isProcessing}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
