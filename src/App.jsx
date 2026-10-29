import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { Dashboard } from './components/layout/Dashboard';
import { Compressor } from './components/tools/Compressor';
import { Resizer } from './components/tools/Resizer';
import { Upscaler } from './components/tools/Upscaler';
import { BgRemover } from './components/tools/BgRemover';
import { PhotoEditor } from './components/tools/PhotoEditor';
import { Converter } from './components/tools/Converter';
import { Watermark } from './components/tools/Watermark';
import { WatermarkRemover } from './components/tools/WatermarkRemover';
import { ArrowLeft } from 'lucide-react';

export function App() {
  const [activeTool, setActiveTool] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('iloveimg-theme') || 'dark');

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('iloveimg-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const renderActiveTool = () => {
    switch (activeTool) {
      case 'compress':
        return <Compressor />;
      case 'resize':
        return <Resizer />;
      case 'upscale':
        return <Upscaler />;
      case 'bg-remove':
        return <BgRemover />;
      case 'photo-editor':
        return <PhotoEditor />;
      case 'convert':
      case 'converter':
      case 'ocr':
        return <Converter />;
      case 'watermark':
        return <Watermark />;
      case 'watermark-remover':
        return <WatermarkRemover />;
      default:
        return <Dashboard onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div className="app-container">
      <Header
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Floating Back Navigation when in a specific tool */}
      {activeTool !== null && (
        <div style={{ maxWidth: '1360px', width: '100%', margin: '0.75rem auto 0', padding: '0 1.75rem' }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setActiveTool(null)}
          >
            <ArrowLeft size={13} />
            <span>All Tools</span>
          </button>
        </div>
      )}

      {renderActiveTool()}

      <footer className="pro-footer">
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.9rem' }}>
            <span>Tool</span><span style={{ color: 'var(--primary)' }}>Hub</span>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>— Private Enterprise Studio</span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.775rem' }}>
            In-Browser Execution & Cloud OCR Engine • Fast, Private & Secure
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
