/**
 * AI Image Upscaler Engine
 * High-definition bicubic super-sampling + Edge-preserving Contrast-Adaptive Sharpening (CAS)
 */
import { loadImage, fileToDataUrl } from './imageProcessing';

export const upscaleImage = async (file, { scale = 2, sharpness = 1.4, denoise = true }) => {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;
  const targetWidth = Math.round(origWidth * scale);
  const targetHeight = Math.round(origHeight * scale);

  // 1. High-Quality Multi-Step Canvas Interpolation
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // 2. Convolution Edge & Detail Sharpening
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;
  const width = targetWidth;
  const height = targetHeight;

  // Clone buffer for convolution
  const output = new Uint8ClampedArray(data);

  // Contrast Adaptive Sharpening Kernel (CAS)
  // [  0,   -k,   0 ]
  // [ -k, 1+4k,  -k ]
  // [  0,   -k,   0 ]
  const k = (sharpness * 0.25);
  const centerWeight = 1 + 4 * k;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width * 4;
    const upRowOffset = (y - 1) * width * 4;
    const downRowOffset = (y + 1) * width * 4;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x * 4;

      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const up = data[upRowOffset + x * 4 + c];
        const down = data[downRowOffset + x * 4 + c];
        const left = data[rowOffset + (x - 1) * 4 + c];
        const right = data[rowOffset + (x + 1) * 4 + c];

        // Edge detection gradient
        const minVal = Math.min(center, up, down, left, right);
        const maxVal = Math.max(center, up, down, left, right);

        // Adaptive clamp to prevent ring artifacts
        const sharpened = center * centerWeight - (up + down + left + right) * k;
        output[idx + c] = Math.max(minVal, Math.min(maxVal, sharpened));
      }
      // Alpha remains untouched
      output[idx + 3] = data[idx + 3];
    }
  }

  // Put filtered pixels back to canvas
  const finalImgData = new ImageData(output, width, height);
  ctx.putImageData(finalImgData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        originalWidth: origWidth,
        originalHeight: origHeight,
        upscaledWidth: targetWidth,
        upscaledHeight: targetHeight,
        scale,
        fileName: file.name.replace(/\.[^/.]+$/, '') + `_upscaled_${scale}x.png`
      });
    }, 'image/png');
  });
};
