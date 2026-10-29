import React, { useState } from 'react';
import { 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  Wand2, 
  Palette, 
  Repeat, 
  Stamp, 
  Eraser, 
  ArrowRight,
  Search
} from 'lucide-react';

const DASHBOARD_TOOLS = [
  {
    id: 'converter',
    title: 'Converter',
    desc: 'PDF to Word (.docx), Word to PDF, OCR PDF, and Image to Word.',
    icon: Repeat,
    color: '#ef4444',
    badge: 'PDF & Word'
  },
  {
    id: 'compress',
    title: 'Compress Image',
    desc: 'Reduce file size without quality loss. Batch support.',
    icon: Minimize2,
    color: '#ef4444',
    badge: 'Save Size'
  },
  {
    id: 'resize',
    title: 'Resize Image',
    desc: 'Scale by pixels or percentage with aspect ratio lock.',
    icon: Maximize2,
    color: '#06b6d4',
    badge: 'Custom Res'
  },
  {
    id: 'upscale',
    title: 'AI Upscaler',
    desc: '2x & 4x super resolution with neural detail sharpening.',
    icon: Sparkles,
    color: '#8b5cf6',
    badge: 'AI 4x'
  },
  {
    id: 'bg-remove',
    title: 'Remove Background',
    desc: 'Instant transparent PNG cutout or custom backdrop.',
    icon: Wand2,
    color: '#ec4899',
    badge: 'AI Cutout'
  },
  {
    id: 'photo-editor',
    title: 'Photo Editor',
    desc: 'Lighting, crop, rotate, flip, filters, and stamps.',
    icon: Palette,
    color: '#eab308',
    badge: 'Studio'
  },
  {
    id: 'watermark',
    title: 'Add Watermark',
    desc: 'Protect photos with text or logo stamps and tiled grids.',
    icon: Stamp,
    color: '#3b82f6',
    badge: 'Stamp'
  },
  {
    id: 'watermark-remover',
    title: 'Watermark Remover',
    desc: 'Erase watermarks, logos and dates with texture inpainting.',
    icon: Eraser,
    color: '#f97316',
    badge: 'AI Erase'
  }
];

export const Dashboard = ({ onSelectTool }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = DASHBOARD_TOOLS.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="dashboard-main">
      {/* Ultra-Clean Compact Header */}
      <section className="dashboard-hero">
        <h1 className="dashboard-title">
          All-in-One Image & File Studio
        </h1>

        {/* Quick Instant Search */}
        <div className="search-bar-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search tool (e.g. compress, convert, remove bg, upscale...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Grid of Tools — Front and Center */}
      <div className="tools-grid">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className="tool-card"
              onClick={() => onSelectTool(tool.id)}
            >
              <div className="tool-card-top">
                <div 
                  className="tool-card-icon"
                  style={{ backgroundColor: tool.color }}
                >
                  <Icon size={20} />
                </div>
                <span className="format-badge" style={{ color: tool.color, borderColor: `${tool.color}35` }}>
                  {tool.badge}
                </span>
              </div>

              <h2 className="tool-card-title">{tool.title}</h2>
              <p className="tool-card-desc">{tool.desc}</p>

              <div className="tool-card-action">
                <span>Open</span>
                <ArrowRight size={13} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
};
