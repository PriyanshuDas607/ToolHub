import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

export const BeforeAfter = ({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Before',
  afterLabel = 'After',
  labelPosition = 'top',
  framed = true
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const wrapRef = useRef(null);
  const baseImgRef = useRef(null);

  const updateDimensions = useCallback(() => {
    if (baseImgRef.current) {
      setDimensions({
        width: baseImgRef.current.clientWidth,
        height: baseImgRef.current.clientHeight
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  const handleMove = useCallback((clientX) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let percent = (x / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    setSliderPos(percent);
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="before-after-container">
      <div 
        className={`before-after-img-wrap ${framed ? 'framed-canvas' : ''}`}
        ref={wrapRef}
        onClick={(e) => handleMove(e.clientX)}
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '100%',
          maxHeight: '68vh',
          boxShadow: framed ? '0 10px 30px rgba(0,0,0,0.6)' : 'none',
          borderRadius: framed ? '4px' : '0'
        }}
      >
        {/* AFTER IMAGE (Base Layer) */}
        <img 
          ref={baseImgRef}
          src={afterSrc} 
          alt={afterLabel}
          onLoad={updateDimensions}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }}
        />

        {/* BEFORE IMAGE (Clipped Layer on Left) */}
        <div 
          className="before-after-overlay"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            height: '100%', 
            width: `${sliderPos}%`,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          <img 
            src={beforeSrc} 
            alt={beforeLabel} 
            style={{ 
              display: 'block',
              width: dimensions.width ? `${dimensions.width}px` : '100%', 
              height: dimensions.height ? `${dimensions.height}px` : '100%',
              maxWidth: 'none',
              maxHeight: 'none',
              objectFit: 'contain'
            }} 
          />
        </div>

        {/* SLIDER HANDLE */}
        <div 
          className="before-after-handle"
          style={{ 
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${sliderPos}%`,
            width: '2px',
            background: '#ffffff',
            cursor: 'ew-resize',
            zIndex: 20
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="before-after-badge">
            <ChevronsLeftRight size={14} />
          </div>
        </div>

        {/* LABELS */}
        <span className={labelPosition === 'top' ? 'before-tag-top' : 'before-tag'}>{beforeLabel}</span>
        <span className={labelPosition === 'top' ? 'after-tag-top' : 'after-tag'}>{afterLabel}</span>
      </div>
    </div>
  );
};
