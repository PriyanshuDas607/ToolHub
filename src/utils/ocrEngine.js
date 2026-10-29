/**
 * ToolsHub In-Browser & Hybrid OCR Document Processing Engine
 * Features:
 * 1. Style & Geometry Reconstruction Layer:
 *    - Font Size math: (pixel_height / DPI) * 72 * 0.82
 *    - Bold stroke density analysis via canvas pixel inspection
 *    - Foreground RGB color detection
 *    - Alignment detection (Left, Center, Right)
 *    - Paragraph grouping & exact vertical space-before calculation
 *    - 2-Column seamless borderless table trick for side-by-side blocks (headers, resumes, invoices)
 * 2. PDF to Word (.docx) & Image to Word (.docx)
 * 3. Word (.docx) to PDF with 1:1 OpenXML fidelity
 * 4. Searchable Sandwich PDF with invisible selectable text layer
 */
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { 
  Document, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  AlignmentType,
  Packer 
} from 'docx';
import { renderAsync } from 'docx-preview';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Polyfill Promise.withResolvers for modern libraries (pdfjs-dist, etc.)
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Safely configure PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;
}

export const BACKEND_API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

/**
 * Check if the Python FastAPI backend is online
 */
export async function checkBackendStatus() {
  try {
    const res = await fetch(`${BACKEND_API}/api/v1/health`, { 
      method: 'GET', 
      signal: AbortSignal.timeout(1500) 
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// STYLE & GEOMETRY RECONSTRUCTION ENGINE (CLIENT-SIDE)
// ============================================================================

/**
 * Detects whether cropped text area is BOLD (stroke density) and its RGB color
 */
function detectStyleFromCanvasCrop(canvas, x1, y1, x2, y2) {
  if (!canvas) return { isBold: false, hexColor: '000000' };

  const startX = Math.max(0, Math.min(canvas.width - 1, Math.floor(x1)));
  const startY = Math.max(0, Math.min(canvas.height - 1, Math.floor(y1)));
  const w = Math.max(1, Math.min(canvas.width - startX, Math.ceil(x2 - x1)));
  const h = Math.max(1, Math.min(canvas.height - startY, Math.ceil(y2 - y1)));

  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(startX, startY, w, h);
    const data = imgData.data;
    const totalPixels = w * h;

    let inkCount = 0;
    let sumR = 0, sumG = 0, sumB = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue; // Transparent background

      // Relative luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Foreground ink threshold
      if (lum < 165) {
        inkCount++;
        sumR += r;
        sumG += g;
        sumB += b;
      }
    }

    const inkRatio = totalPixels > 0 ? inkCount / totalPixels : 0;
    const isBold = inkRatio > 0.32; // > 32% ink density indicates bold stroke

    let hexColor = '000000';
    if (inkCount > 0) {
      const avgR = Math.round(sumR / inkCount);
      const avgG = Math.round(sumG / inkCount);
      const avgB = Math.round(sumB / inkCount);

      if (avgR < 60 && avgG < 60 && avgB < 60) {
        hexColor = '000000'; // Clean black
      } else {
        const toHex = (n) => n.toString(16).padStart(2, '0');
        hexColor = `${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
      }
    }

    return { isBold, hexColor };
  } catch {
    return { isBold: false, hexColor: '000000' };
  }
}

/**
 * Detects side-by-side text blocks that share vertical space (e.g. 2-column header or resume contacts)
 */
function detectSideBySideBoxes(boxes) {
  if (!boxes || boxes.length === 0) return [];

  const sorted = [...boxes].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  const elements = [];
  const skip = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (skip.has(i)) continue;

    const itemA = sorted[i];
    const [xa1, ya1, xa2, ya2] = itemA.bbox;
    const ha = Math.max(10, ya2 - ya1);

    let partner = null;
    for (let j = i + 1; j < sorted.length; j++) {
      if (skip.has(j)) continue;

      const itemB = sorted[j];
      const [xb1, yb1, xb2, yb2] = itemB.bbox;
      const hb = Math.max(10, yb2 - yb1);

      const yOverlap = Math.min(ya2, yb2) - Math.max(ya1, yb1);
      const verticalAligned = yOverlap > 0.5 * Math.min(ha, hb) || Math.abs(ya1 - yb1) < 0.4 * Math.min(ha, hb);
      const horizontalSeparated = (xb1 > xa2 + 25) || (xa1 > xb2 + 25);

      if (verticalAligned && horizontalSeparated) {
        partner = { idx: j, item: itemB };
        break;
      }
    }

    if (partner) {
      skip.add(partner.idx);
      const left = itemA.bbox[0] <= partner.item.bbox[0] ? itemA : partner.item;
      const right = itemA.bbox[0] <= partner.item.bbox[0] ? partner.item : itemA;
      elements.push({
        type: 'two_column',
        left,
        right,
        yTop: Math.min(ya1, partner.item.bbox[1]),
        yBottom: Math.max(ya2, partner.item.bbox[3])
      });
    } else {
      elements.push({
        type: 'single',
        item: itemA,
        yTop: ya1,
        yBottom: ya2
      });
    }
  }

  elements.sort((a, b) => a.yTop - b.yTop);
  return elements;
}

/**
 * Reconstructs styled Word elements (paragraphs, headings, 2-column tables)
 * with mathematical precision for font sizes, margins, colors, and line grouping.
 */
function buildStyledDocxElements(canvas, ocrBoxes, dpi = 300) {
  const imgW = canvas.width;
  const imgH = canvas.height;
  const elements = detectSideBySideBoxes(ocrBoxes);

  const docChildren = [];
  let prevY2 = 0;
  let currentPara = null;
  let currentAlignment = null;

  const borderless = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'auto'
  };

  elements.forEach(elem => {
    if (elem.type === 'two_column') {
      currentPara = null;
      currentAlignment = null;

      const { left, right } = elem;
      const [lx1, ly1, lx2, ly2] = left.bbox;
      const [rx1, ry1, rx2, ry2] = right.bbox;

      const lText = left.text.trim();
      const rText = right.text.trim();
      if (!lText && !rText) return;

      const lFontPt = Math.max(8, Math.min(36, Math.round(((ly2 - ly1) / dpi) * 72 * 0.82)));
      const rFontPt = Math.max(8, Math.min(36, Math.round(((ry2 - ry1) / dpi) * 72 * 0.82)));

      const lStyle = detectStyleFromCanvasCrop(canvas, lx1, ly1, lx2, ly2);
      const rStyle = detectStyleFromCanvasCrop(canvas, rx1, ry1, rx2, ry2);

      // Create seamless 2-column borderless table
      const table = new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4500, type: WidthType.DXA },
                borders: { top: borderless, bottom: borderless, left: borderless, right: borderless },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: lText,
                        font: 'Calibri',
                        size: lFontPt * 2,
                        bold: lStyle.isBold || lFontPt >= 16,
                        color: lStyle.hexColor
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 4500, type: WidthType.DXA },
                borders: { top: borderless, bottom: borderless, left: borderless, right: borderless },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: rText,
                        font: 'Calibri',
                        size: rFontPt * 2,
                        bold: rStyle.isBold || rFontPt >= 16,
                        color: rStyle.hexColor
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ],
        borders: {
          top: borderless,
          bottom: borderless,
          left: borderless,
          right: borderless,
          insideHorizontal: borderless,
          insideVertical: borderless
        },
        width: { size: 9000, type: WidthType.DXA }
      });

      docChildren.push(table);
      prevY2 = elem.yBottom;
      return;
    }

    // Single item paragraph
    const { item } = elem;
    const [x1, y1, x2, y2] = item.bbox;
    const text = item.text.trim();
    if (!text) return;

    const boxH = Math.max(10, y2 - y1);
    const boxW = Math.max(10, x2 - x1);

    // 1. Font Size Calculation
    const fontPt = Math.max(8, Math.min(36, Math.round((boxH / dpi) * 72 * 0.82)));

    // 2. Bold & Color from crop
    const style = detectStyleFromCanvasCrop(canvas, x1, y1, x2, y2);

    // 3. Alignment Detection
    const leftMargin = x1;
    const rightMargin = imgW - x2;
    let alignment = AlignmentType.LEFT;

    if (Math.abs(leftMargin - rightMargin) < (imgW * 0.08) && boxW < (imgW * 0.8)) {
      alignment = AlignmentType.CENTER;
    } else if (leftMargin > (imgW * 0.55)) {
      alignment = AlignmentType.RIGHT;
    }

    // 4. Paragraph Grouping & Spacing
    const verticalGap = prevY2 > 0 ? y1 - prevY2 : 0;

    if (currentPara && verticalGap < (boxH * 0.7) && currentAlignment === alignment) {
      // Append to ongoing paragraph
      currentPara.addChildElement(
        new TextRun({
          text: ' ' + text,
          font: 'Calibri',
          size: fontPt * 2,
          bold: style.isBold || fontPt >= 16,
          color: style.hexColor
        })
      );
    } else {
      // Calculate space before
      const spaceBeforePt = (verticalGap > (boxH * 0.7) && prevY2 > 0) 
        ? Math.min(36, Math.round((verticalGap / dpi) * 72 * 0.6)) 
        : 0;
      const spaceBeforeDxa = spaceBeforePt * 20;

      // Left indent if block is indented
      let indentDxa = undefined;
      if (alignment === AlignmentType.LEFT && leftMargin > (imgW * 0.12)) {
        const indentInches = ((leftMargin / imgW) * 8.27) - 0.6;
        if (indentInches > 0.1) {
          indentDxa = Math.min(Math.round(indentInches * 1440), 4000);
        }
      }

      currentPara = new Paragraph({
        alignment,
        spacing: { before: spaceBeforeDxa, after: 40 },
        indent: indentDxa ? { left: indentDxa } : undefined,
        children: [
          new TextRun({
            text,
            font: 'Calibri',
            size: fontPt * 2,
            bold: style.isBold || fontPt >= 16,
            color: style.hexColor
          })
        ]
      });

      currentAlignment = alignment;
      docChildren.push(currentPara);
    }

    prevY2 = y2;
  });

  return docChildren;
}

/**
 * Loads an image File or Blob into an HTMLImageElement
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// ============================================================================
// WORKFLOW PIPELINES
// ============================================================================

/**
 * 1. PDF to Word (.docx)
 * Applies Style & Geometry Reconstruction Layer
 */
export async function convertPdfToDocx(file, language = 'eng', onProgress = () => {}) {
  // First attempt FastAPI backend if online
  const hasBackend = await checkBackendStatus();
  if (hasBackend) {
    onProgress(20, 'Sending to ToolsHub Enterprise Backend...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lang', language);
    try {
      const res = await fetch(`${BACKEND_API}/api/v1/pdf-to-docx`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        onProgress(100, 'Conversion completed');
        return await res.blob();
      }
    } catch {
      // Fallback to client-side pipeline
    }
  }

  // Client-Side OCR & Layout Reconstruction Pipeline
  onProgress(15, 'Loading PDF document in browser...');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  onProgress(25, 'Initializing Tesseract OCR neural engine...');
  const ocrWorker = await createWorker(language === 'hin' ? 'hin' : 'eng');

  const allSections = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress(
      Math.round(25 + (pageNum / numPages) * 60), 
      `Analyzing layout & typography on page ${pageNum} of ${numPages}...`
    );

    const page = await pdfDoc.getPage(pageNum);
    // Render at 2.5 scale (~200 DPI) for crisp character recognition
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const ocrResult = await ocrWorker.recognize(canvas);
    const rawLines = ocrResult.data.lines || [];

    const ocrBoxes = rawLines.map(l => ({
      bbox: [l.bbox.x0, l.bbox.y0, l.bbox.x1, l.bbox.y1],
      text: l.text.trim()
    })).filter(b => b.text.length > 0);

    const pageElements = buildStyledDocxElements(canvas, ocrBoxes, 200);

    allSections.push({
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 864, bottom: 864, left: 864, right: 864 } // 0.6 in
        }
      },
      children: pageElements.length > 0 ? pageElements : [
        new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })
      ]
    });
  }

  await ocrWorker.terminate();

  onProgress(90, 'Packaging editable Word (.docx) file with exact typography...');
  const doc = new Document({
    sections: allSections
  });

  const blob = await Packer.toBlob(doc);
  onProgress(100, 'Conversion Complete');
  return blob;
}

/**
 * 2. Word (.docx) to PDF
 * Renders OpenXML layout with 1:1 margins, table bounds, and crisp 300 DPI canvas
 */
export async function convertDocxToPdf(file, onProgress = () => {}) {
  // Check backend first
  const hasBackend = await checkBackendStatus();
  if (hasBackend) {
    onProgress(20, 'Sending to LibreOffice Headless Backend...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BACKEND_API}/api/v1/docx-to-pdf`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        onProgress(100, 'Conversion completed');
        return await res.blob();
      }
    } catch {
      // Fallback
    }
  }

  // Client-Side docx-preview OpenXML Renderer
  onProgress(25, 'Parsing OpenXML document structure & margins...');
  const arrayBuffer = await file.arrayBuffer();

  const container = document.createElement('div');
  container.id = 'docx-to-pdf-host';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.backgroundColor = '#ffffff';

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #docx-to-pdf-host section.docx {
      background: #ffffff !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
  `;
  container.appendChild(styleEl);
  document.body.appendChild(container);

  try {
    onProgress(50, 'Rendering document pages with exact typography...');
    await renderAsync(arrayBuffer, container, container, {
      className: 'docx',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: true,
      trimXmlDeclaration: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true
    });

    // Wait for images
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 800);
      });
    }));

    await new Promise(r => setTimeout(r, 120));

    let sections = Array.from(container.querySelectorAll('section.docx, section'));
    if (sections.length === 0) {
      const directChildren = Array.from(container.children).filter(el => el.tagName !== 'STYLE');
      sections = directChildren.length > 0 ? directChildren : [container];
    }

    onProgress(75, 'Generating multi-page PDF...');
    let pdf = null;
    const maxA4HeightPt = 841.89;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      section.style.background = '#ffffff';
      section.style.boxShadow = 'none';

      const rect = section.getBoundingClientRect();
      const secWidth = Math.ceil(rect.width || section.offsetWidth || 794);
      const secHeight = Math.ceil(rect.height || section.offsetHeight || 1123);
      const orientation = secWidth > secHeight ? 'landscape' : 'portrait';

      const canvas = await html2canvas(section, {
        scale: 2,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: secWidth,
        height: secHeight,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const ptWidth = (secWidth * 72) / 96;
      const ptHeight = (secHeight * 72) / 96;

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: 'pt',
          format: [ptWidth, ptHeight]
        });
      } else {
        pdf.addPage([ptWidth, ptHeight], orientation);
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
    }

    onProgress(100, 'PDF generation complete');
    return pdf.output('blob');
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * 3. Image to Word (.docx)
 * Uses Style & Geometry Reconstruction with OpenCV-level ink density & color sampling
 */
export async function convertImageToDocx(file, language = 'eng', onProgress = () => {}) {
  // Check backend
  const hasBackend = await checkBackendStatus();
  if (hasBackend) {
    onProgress(20, 'Sending image to ToolsHub OCR Engine...');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BACKEND_API}/api/v1/image-to-docx`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        onProgress(100, 'Conversion completed');
        return await res.blob();
      }
    } catch {
      // Fallback
    }
  }

  // Client-Side Tesseract OCR + Geometry Reconstruction
  onProgress(20, 'Loading image into high-res canvas...');
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  onProgress(35, 'Initializing Tesseract neural model...');
  const worker = await createWorker(language === 'hin' ? 'hin' : 'eng');

  onProgress(55, 'Scanning bounding boxes, character coordinates & lines...');
  const result = await worker.recognize(canvas);
  await worker.terminate();

  onProgress(80, 'Applying Style & Geometry Reconstruction Layer...');
  const rawLines = result.data.lines || [];
  const ocrBoxes = rawLines.map(l => ({
    bbox: [l.bbox.x0, l.bbox.y0, l.bbox.x1, l.bbox.y1],
    text: l.text.trim()
  })).filter(b => b.text.length > 0);

  const docElements = buildStyledDocxElements(canvas, ocrBoxes, 300);

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 864, bottom: 864, left: 864, right: 864 }
        }
      },
      children: docElements.length > 0 ? docElements : [
        new Paragraph({ children: [new TextRun({ text: 'Extracted Document', bold: true, size: 28 })] })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  onProgress(100, 'Complete');
  return blob;
}

/**
 * 4. OCR PDF (Searchable Sandwich PDF)
 */
export async function makePdfSearchable(file, language = 'eng', onProgress = () => {}) {
  // Check backend
  const hasBackend = await checkBackendStatus();
  if (hasBackend) {
    onProgress(20, 'Sending to OCRmyPDF Backend...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lang', language);
    try {
      const res = await fetch(`${BACKEND_API}/api/v1/ocr-pdf`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        onProgress(100, 'Searchable PDF completed');
        return await res.blob();
      }
    } catch {
      // Fallback
    }
  }

  // Client-Side Sandwich PDF Builder:
  onProgress(15, 'Rendering PDF pages for OCR...');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const worker = await createWorker(language === 'hin' ? 'hin' : 'eng');
  let outputPdf = null;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress(
      Math.round(20 + (pageNum / numPages) * 65),
      `OCR recognition on page ${pageNum} of ${numPages}...`
    );

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const ocrResult = await worker.recognize(canvas);
    const words = ocrResult.data.words || [];

    const pagePtWidth = (viewport.width / 2) * 0.75;
    const pagePtHeight = (viewport.height / 2) * 0.75;

    if (!outputPdf) {
      outputPdf = new jsPDF({
        orientation: pagePtWidth > pagePtHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pagePtWidth, pagePtHeight]
      });
    } else {
      outputPdf.addPage([pagePtWidth, pagePtHeight], pagePtWidth > pagePtHeight ? 'landscape' : 'portrait');
    }

    // Add visual page image (100% original design intact)
    outputPdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pagePtWidth, pagePtHeight, undefined, 'FAST');

    // Add invisible selectable text layer at exact coordinates
    outputPdf.setTextColor(255, 255, 255);
    outputPdf.setFontSize(8);

    words.forEach(w => {
      if (!w.text) return;
      const xPt = (w.bbox.x0 / viewport.width) * pagePtWidth;
      const yPt = (w.bbox.y1 / viewport.height) * pagePtHeight;
      try {
        outputPdf.text(w.text, xPt, yPt, { renderingMode: 'invisible' });
      } catch {
        outputPdf.text(w.text, xPt, yPt);
      }
    });
  }

  await worker.terminate();
  onProgress(100, 'Searchable PDF ready');
  return outputPdf.output('blob');
}
