import { inpaintImage } from './inpainting';

/**
 * High-Performance Automatic Watermark, Camera Icon, and Repeating Grid Remover
 * Supports both Backend AI Engine (FastAPI + OpenCV) and Client-Side Canvas Inpainting Fallback.
 */

export async function removeWatermarkAuto(
  sourceCanvasOrFile,
  {
    model = 'fast',
    removeText = true,
    removeLogo = true,
    manualMaskCanvas = null,
    backendUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
  } = {}
) {
  // 1. Try calling the backend FastAPI OpenCV engine if reachable
  try {
    const formData = new FormData();
    let blobToSend = null;

    if (sourceCanvasOrFile instanceof File || sourceCanvasOrFile instanceof Blob) {
      blobToSend = sourceCanvasOrFile;
    } else if (sourceCanvasOrFile instanceof HTMLCanvasElement) {
      blobToSend = await new Promise((resolve) => sourceCanvasOrFile.toBlob(resolve, 'image/jpeg', 0.95));
    }

    if (blobToSend) {
      formData.append('file', blobToSend, 'image.jpg');
      formData.append('model', model);
      formData.append('remove_text', removeText ? 'true' : 'false');
      formData.append('remove_logo', removeLogo ? 'true' : 'false');

      if (manualMaskCanvas) {
        const maskBlob = await new Promise((resolve) => manualMaskCanvas.toBlob(resolve, 'image/png'));
        formData.append('mask', maskBlob, 'mask.png');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch(`${backendUrl}/api/v1/remove-watermark`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const resultBlob = await resp.blob();
        const resultUrl = URL.createObjectURL(resultBlob);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = resultUrl;
        });

        const outCanvas = document.createElement('canvas');
        outCanvas.width = img.naturalWidth || img.width;
        outCanvas.height = img.naturalHeight || img.height;
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        return {
          cleanCanvas: outCanvas,
          cleanBlob: resultBlob,
          cleanUrl: resultUrl,
          usedBackend: true
        };
      }
    }
  } catch (err) {
    console.warn('Backend watermark engine unavailable, falling back to Client-Side AI Inpainter:', err);
  }

  // 2. Client-Side High-Precision In-Browser Execution
  return runClientSideAutoWatermark(sourceCanvasOrFile, {
    model,
    removeText,
    removeLogo,
    manualMaskCanvas
  });
}

/**
 * Client-Side Inpainting Engine
 */
async function runClientSideAutoWatermark(
  sourceCanvasOrFile,
  { model, removeText, removeLogo, manualMaskCanvas }
) {
  let baseCanvas = sourceCanvasOrFile;
  if (!(baseCanvas instanceof HTMLCanvasElement)) {
    const img = new Image();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(sourceCanvasOrFile);
    });
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = dataUrl;
    });
    baseCanvas = document.createElement('canvas');
    baseCanvas.width = img.naturalWidth || img.width;
    baseCanvas.height = img.naturalHeight || img.height;
    const ctx = baseCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
  }

  const width = baseCanvas.width;
  const height = baseCanvas.height;
  const size = width * height;

  const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // Extract luminance
  const lum = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const p = i * 4;
    lum[i] = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
  }

  // Fast 2-pass box blur for local baseline luminance estimation
  const blurred = new Float32Array(size);
  const temp = new Float32Array(size);
  const r = 4; // 9x9 neighborhood

  // Horizontal blur pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -r; x <= r; x++) {
      const px = Math.min(width - 1, Math.max(0, x));
      sum += lum[row + px];
    }
    temp[row] = sum / (2 * r + 1);
    for (let x = 1; x < width; x++) {
      const left = Math.max(0, x - r - 1);
      const right = Math.min(width - 1, x + r);
      sum += lum[row + right] - lum[row + left];
      temp[row + x] = sum / (2 * r + 1);
    }
  }

  // Vertical blur pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const py = Math.min(height - 1, Math.max(0, y));
      sum += temp[py * width + x];
    }
    blurred[x] = sum / (2 * r + 1);
    for (let y = 1; y < height; y++) {
      const top = Math.max(0, y - r - 1);
      const bottom = Math.min(height - 1, y + r);
      sum += temp[bottom * width + x] - temp[top * width + x];
      blurred[y * width + x] = sum / (2 * r + 1);
    }
  }

  // Watermark Stroke Isolation (Top-Hat differential)
  const maskArray = new Uint8Array(size);
  const thresh = model === 'deep' ? 9.0 : 12.0;

  let detectedPixels = 0;
  for (let i = 0; i < size; i++) {
    const delta = lum[i] - blurred[i];
    // Stock watermarks are additive light lines (+delta) or high-contrast dark lines (-delta)
    if (delta > thresh || delta < -16) {
      maskArray[i] = 1;
      detectedPixels++;
    }
  }

  // Morphological filter: dilate stroke mask by 1 pixel to envelop anti-aliased edges
  const dilatedMask = new Uint8Array(size);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      if (
        maskArray[idx] ||
        maskArray[idx - 1] ||
        maskArray[idx + 1] ||
        maskArray[idx - width] ||
        maskArray[idx + width]
      ) {
        dilatedMask[idx] = 1;
      }
    }
  }

  // Create Mask Canvas
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  const maskData = maskCtx.createImageData(width, height);

  for (let i = 0; i < size; i++) {
    if (dilatedMask[i] === 1) {
      const p = i * 4;
      maskData.data[p] = 255;
      maskData.data[p + 1] = 0;
      maskData.data[p + 2] = 0;
      maskData.data[p + 3] = 255;
    }
  }
  maskCtx.putImageData(maskData, 0, 0);

  // Merge manual brush mask if provided
  if (manualMaskCanvas) {
    maskCtx.drawImage(manualMaskCanvas, 0, 0);
  }

  // Run seamless Telea FMM inpainting on the exact stroke mask
  const cleanCanvas = inpaintImage(baseCanvas, maskCanvas, 5, 'telea');

  const cleanBlob = await new Promise((resolve) => cleanCanvas.toBlob(resolve, 'image/jpeg', 0.98));
  const cleanUrl = URL.createObjectURL(cleanBlob);

  return {
    cleanCanvas,
    cleanBlob,
    cleanUrl,
    maskCanvas,
    usedBackend: false
  };
}
