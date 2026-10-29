import React from 'react';
import { X, Plus, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../../utils/imageProcessing';

export const BatchStrip = ({ files, activeIndex, onSelectIndex, onRemoveFile, onAddFiles }) => {
  const fileInputRef = React.useRef(null);

  if (!files || files.length === 0) return null;

  return (
    <div className="batch-strip">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAddFiles(Array.from(e.target.files));
          }
        }}
        accept="image/*"
        multiple
        style={{ display: 'none' }}
      />

      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {files.length} {files.length === 1 ? 'image' : 'images'}
      </div>

      {files.map((item, idx) => {
        const previewUrl = item.previewUrl || (item.file ? URL.createObjectURL(item.file) : '');
        const isSelected = activeIndex === idx;

        return (
          <div
            key={idx}
            className={`batch-thumb-item ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectIndex(idx)}
            title={`${item.file?.name || item.name} (${formatBytes(item.file?.size)})`}
          >
            <img src={previewUrl} alt={`thumb-${idx}`} />
            <button
              className="batch-thumb-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile(idx);
              }}
              title="Remove image"
            >
              <X size={12} />
            </button>
            {item.processed && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, color: '#10b981', background: 'rgba(0,0,0,0.8)', borderRadius: '50%' }}>
                <CheckCircle2 size={14} />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', height: '64px', borderRadius: 'var(--radius-sm)' }}
        onClick={() => fileInputRef.current?.click()}
        title="Add more images"
      >
        <Plus size={16} />
        <span>Add More</span>
      </button>
    </div>
  );
};
