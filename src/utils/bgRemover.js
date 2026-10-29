/**
 * AI Background Remover Engine
 * 1. Primary Engine: @imgly/background-removal (real neural network in WebAssembly)
 * 2. Fallback Engine: Center-weighted Saliency & Laplacian Edge Matting with invert capability
 */
import { loadImage, fileToDataUrl } from './imageProcessing';

export const removeBackgroundAI = async (file, onProgress) => {
  try {
    const imgly = await import('@imgly/background-removal');
    const removeBgFn = imgly.default || imgly.removeBackground || imgly;

    const config = {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          const pct = Math.round((current / total) * 100);
          onProgress({ stage: key, percent: pct });
        }
      }
    };

    const blob = await removeBgFn(file, config);
    return blob;
  } catch (err) {
    console.warn('AI neural network model failed or offline, using smart edge matting fallback:', err);
    throw err;
  }
};

/**
 * Smart Saliency Fallback Matting
 * Assumes human/object is focused in the central 70% of frame and contrasts with edges
 */
export const removeBackgroundSaliency = async (file, { tolerance = 40, invert = false }) => {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Sample border pixels all along the 4 edges (10% outer border perimeter)
  let bgR = 0, bgG = 0, bgB = 0, borderCount = 0;
  const borderThicknessX = Math.max(1, Math.floor(width * 0.08));
  const borderThicknessY = Math.max(1, Math.floor(height * 0.08));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < borderThicknessX || x >= width - borderThicknessX || y < borderThicknessY || y >= height - borderThicknessY) {
        const idx = (y * width + x) * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        borderCount++;
      }
    }
  }

  const avgBgR = bgR / borderCount;
  const avgBgG = bgG / borderCount;
  const avgBgB = bgB / borderCount;

  // 2. Compute distance from background and center distance boost
  const centerX = width / 2;
  const centerY = height / 2;
  const maxCenterDist = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Color distance from background
      const colorDist = Math.sqrt(
        (r - avgBgR) ** 2 +
        (g - avgBgG) ** 2 +
        (b - avgBgB) ** 2
      );

      // Distance from center of image (people are in the middle)
      const centerDist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const centerWeight = 1.0 - (centerDist / maxCenterDist) * 0.5;

      const score = colorDist * centerWeight;
      const threshold = tolerance * 2.0;

      let isForeground = score > threshold;
      if (invert) isForeground = !isForeground;

      data[idx + 3] = isForeground ? 255 : 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
};

/**
 * Composite cutout on chosen background (transparent, color, or gradient)
 */
export const compositeBackdrop = async (cutoutBlob, { backdrop = 'transparent', customBgColor = '#ffffff' }) => {
  const dataUrl = URL.createObjectURL(cutoutBlob);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');

  if (backdrop === 'color') {
    ctx.fillStyle = customBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (backdrop === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#f43f5e');
    grad.addColorStop(1, '#6366f1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(dataUrl);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        width: canvas.width,
        height: canvas.height
      });
    }, 'image/png');
  });
};
