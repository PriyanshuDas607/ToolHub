import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles } from 'lucide-react';

export const Dropzone = ({ onFilesSelected, accept = 'image/*', multiple = true, title = 'Select or drop images here', subtitle = 'JPG, PNG, WebP, GIF, SVG up to 50MB' }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  return (
    <div
      className={`dropzone ${isDragActive ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
      />
      <div className="dropzone-icon-pulse">
        <UploadCloud size={36} />
      </div>
      <div>
        <h3 className="dropzone-title">{title}</h3>
        <p className="dropzone-hint">{subtitle}</p>
      </div>
      <button 
        type="button" 
        className="btn btn-primary"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        <ImageIcon size={16} />
        <span>Browse Files</span>
      </button>
    </div>
  );
};
