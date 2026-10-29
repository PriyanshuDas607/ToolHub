/**
 * Comprehensive Image Processing Engine for ILOVEIMG Studio
 * Runs 100% locally in the browser via Canvas 2D & Web APIs
 */

export const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * 1. Image Compression
 */
export const compressImage = async (file, quality = 0.75, targetFormat = null) => {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Default format is jpeg for lossy reduction if png, or keep webp/jpeg
  const format = targetFormat || (file.type === 'image/png' ? 'image/jpeg' : file.type || 'image/jpeg');

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const resultUrl = URL.createObjectURL(blob);
      const originalSize = file.size;
      const compressedSize = blob.size;
      const savedPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

      resolve({
        blob,
        url: resultUrl,
        originalSize,
        compressedSize,
        savedPercent,
        width: canvas.width,
        height: canvas.height,
        fileName: file.name.replace(/\.[^/.]+$/, '') + `_compressed.${format.split('/')[1] || 'jpg'}`
      });
    }, format, quality);
  });
};

/**
 * 2. Image Resizer
 */
export const resizeImage = async (file, { width, height, quality = 0.9, format = 'image/jpeg' }) => {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        width: canvas.width,
        height: canvas.height,
        fileName: file.name.replace(/\.[^/.]+$/, '') + `_resized_${canvas.width}x${canvas.height}.${format.split('/')[1] || 'jpg'}`
      });
    }, format, quality);
  });
};

/**
 * 6. Image Format Converter
 */
export const convertFormat = async (file, targetFormat = 'image/png', quality = 0.92) => {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');

  // If converting transparent image to JPEG, fill white background to avoid black background
  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const ext = extensionMap[targetFormat] || 'png';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        format: targetFormat,
        size: blob.size,
        width: canvas.width,
        height: canvas.height,
        fileName: file.name.replace(/\.[^/.]+$/, '') + `_converted.${ext}`
      });
    }, targetFormat, quality);
  });
};

/**
 * 7. Watermark Composite Engine
 */
export const applyWatermark = async (file, options) => {
  const {
    type = 'text', // 'text' or 'logo'
    text = 'CONFIDENTIAL',
    fontFamily = 'Plus Jakarta Sans',
    fontSize = 36,
    color = '#ffffff',
    opacity = 0.6,
    rotation = -20,
    position = 'center', // 'top-left', 'center', 'bottom-right', 'tiled', etc.
    logoFile = null
  } = options;

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  ctx.save();
  ctx.globalAlpha = opacity;

  if (type === 'text') {
    ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (position === 'tiled') {
      const stepX = fontSize * 8;
      const stepY = fontSize * 5;
      for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      }
    } else {
      // Calculate coordinates
      let x = canvas.width / 2;
      let y = canvas.height / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (position === 'top-left') {
        x = canvas.width * 0.15;
        y = canvas.height * 0.15;
      } else if (position === 'top-right') {
        x = canvas.width * 0.85;
        y = canvas.height * 0.15;
      } else if (position === 'bottom-left') {
        x = canvas.width * 0.15;
        y = canvas.height * 0.85;
      } else if (position === 'bottom-right') {
        x = canvas.width * 0.85;
        y = canvas.height * 0.85;
      }

      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
    }
  } else if (type === 'logo' && logoFile) {
    const logoDataUrl = await fileToDataUrl(logoFile);
    const logoImg = await loadImage(logoDataUrl);

    // Scale logo proportional to main canvas
    const maxLogoWidth = canvas.width * (fontSize / 100);
    const ratio = maxLogoWidth / logoImg.width;
    const logoW = maxLogoWidth;
    const logoH = logoImg.height * ratio;

    let x = (canvas.width - logoW) / 2;
    let y = (canvas.height - logoH) / 2;

    if (position === 'top-left') { x = 30; y = 30; }
    if (position === 'top-right') { x = canvas.width - logoW - 30; y = 30; }
    if (position === 'bottom-left') { x = 30; y = canvas.height - logoH - 30; }
    if (position === 'bottom-right') { x = canvas.width - logoW - 30; y = canvas.height - logoH - 30; }

    ctx.translate(x + logoW / 2, y + logoH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH);
  }

  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        fileName: file.name.replace(/\.[^/.]+$/, '') + `_watermarked.jpg`
      });
    }, 'image/jpeg', 0.92);
  });
};
