import React from 'react';
import { 
  Heart, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Layers, 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  Wand2, 
  Palette, 
  Repeat, 
  Stamp, 
  Eraser
} from 'lucide-react';

const STUDIO_TOOLS = [
  { id: 'compress', name: 'Compress Image', icon: Minimize2, color: '#ef4444' },
  { id: 'resize', name: 'Resize Image', icon: Maximize2, color: '#06b6d4' },
  { id: 'upscale', name: 'AI Upscaler', icon: Sparkles, color: '#8b5cf6' },
  { id: 'bg-remove', name: 'Remove Background', icon: Wand2, color: '#ec4899' },
  { id: 'photo-editor', name: 'Photo Editor', icon: Palette, color: '#eab308' },
  { id: 'watermark', name: 'Add Watermark', icon: Stamp, color: '#3b82f6' },
  { id: 'watermark-remover', name: 'Watermark Remover', icon: Eraser, color: '#f97316' },
];

export const Header = ({ activeTool, onSelectTool, theme, onToggleTheme }) => {
  const isConverterActive = activeTool === 'converter' || activeTool === 'convert';

  return (
    <>
      <header className="pro-header">
        <div className="brand-wrapper" onClick={() => onSelectTool(null)}>
          <div className="brand-mark" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
            <Layers size={16} color="#fff" />
          </div>
          <div className="brand-title">
            Tool<span>Hub</span>
            <span className="brand-tag">PRO</span>
          </div>
        </div>

        {/* Pro Mode Navigation */}
        <div className="segmented-nav">
          <button
            className={`segmented-btn ${!isConverterActive ? 'active' : ''}`}
            onClick={() => onSelectTool(null)}
          >
            <Layers size={13} />
            <span>Studio</span>
          </button>
          <button
            className={`segmented-btn ${isConverterActive ? 'active' : ''}`}
            onClick={() => onSelectTool('converter')}
          >
            <Repeat size={13} />
            <span>Converter</span>
          </button>
        </div>

        <div className="header-right">
          <div className="privacy-badge">
            <ShieldCheck size={13} />
            <span>OCR & PDF</span>
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.55rem', minHeight: '32px' }}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Sub-bar for Image Studio tools */}
      {!isConverterActive && (
        <nav className="category-subnav">
          <button 
            className={`category-chip ${activeTool === null ? 'active' : ''}`}
            onClick={() => onSelectTool(null)}
          >
            <Layers size={12} />
            <span>All Tools</span>
          </button>
          {STUDIO_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                className={`category-chip ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => onSelectTool(tool.id)}
              >
                <Icon size={12} />
                <span>{tool.name}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
