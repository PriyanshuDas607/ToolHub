# Product Requirements Document (PRD) — v2.0
## Project: ILOVEIMG & Universal Converter Studio (Pro Suite)

### 1. Executive Summary & Objective
Re-engineered from the ground up to eliminate generic AI aesthetic tropes. The platform is an industrial-grade, privacy-first personal digital workspace combining an advanced image editing studio with a 6-category **Universal File Converter** (Image, Document, Video, Audio, Archive, Data & Code).

---

### 2. Design System & UI/UX Philosophy
- **Anti-AI-Slop Aesthetics**: No gratuitous neon glow blobs, no random floating emojis, no faux-futuristic clutter.
- **Inspiration**: Professional utility tools (CloudConvert, Linear, Raycast, Vercel).
- **Theme Support**: High-contrast Zinc Dark (`#090a0f`, `#12131a`) & Clean Daylight Light (`#f8fafc`, `#ffffff`).
- **Data Density**: High-utility tables, inline format selectors, conversion pairs, real-time byte counters, batch queues.

---

### 3. Universal Format Converter (6 Core Engines)

#### 3.1. Image Converter
- **Supported Formats**: JPG, JPEG, PNG, WebP, GIF, SVG, BMP, TIFF, AVIF, HEIC/HEIF, ICO.
- **Key Pairs**: `PNG → WebP`, `HEIC → JPG`, `SVG → PNG`, `JPG → ICO` (custom 16x16/32x32/48x48 icon binary), `WEBP → PNG`.
- **Controls**: Output quality, transparency handling, dimension preservation.

#### 3.2. Document Converter
- **Supported Formats**: PDF, DOCX, TXT, RTF, HTML, MD.
- **Key Pairs**: `DOCX → PDF`, `TXT → PDF`, `MD → HTML`, `MD → PDF`, `HTML → PDF`, `DOCX → TXT/MD`.
- **Engine**: Client-side jsPDF rendering + XML DOCX parser.

#### 3.3. Video Converter & Extractor
- **Supported Formats**: MP4, MOV, WebM, MKV, AVI.
- **Key Capabilities**: Video re-encoding (WebM/MP4), Video to Audio extract (`MOV/MP4 → WAV/MP3`), Video to GIF animation frames.

#### 3.4. Audio Converter
- **Supported Formats**: MP3, WAV, AAC, FLAC, OGG, M4A, Opus, WebM Audio.
- **Key Pairs**: `WAV → MP3`, `FLAC → WAV`, `M4A → WAV`, Audio bitrate & sample rate resampler.
- **Engine**: In-browser Web Audio API (`AudioContext`) + 16-bit PCM WAV / MediaRecorder encoder.

#### 3.5. Archive Converter
- **Supported Formats**: ZIP, TAR, GZ, TAR.GZ (TGZ).
- **Key Capabilities**: `TAR.GZ → ZIP`, `ZIP → TAR`, Gzip stream compression/decompression via native `CompressionStream` & `DecompressionStream`.

#### 3.6. Data & Code Format Converter
- **Supported Formats**: JSON, CSV, XML, YAML, HTML, Markdown.
- **Key Pairs**: `JSON ↔ YAML`, `CSV ↔ JSON`, `XML ↔ JSON`, `JSON ↔ XML`, `CSV ↔ YAML`.
- **Engine**: Standard RFC 4180 CSV parser, official `yaml` AST engine, DOMParser XML tree constructor.

---

### 4. Image Editing Studio Suite
1. **Compressor**: Lossy/lossless file size reduction with live Before/After comparison.
2. **Resizer**: Exact pixel & percentage modes with aspect ratio lock.
3. **AI Upscaler**: 2x & 4x super-sampling with edge-preserving CAS sharpening.
4. **AI Background Remover**: Color saliency & edge matting with transparent PNG and custom backdrops.
5. **Photo Editor**: Adjustments (brightness, contrast, saturation, blur), transforms (rotate 90°, flip), vintage/noir filters, text watermarks.
6. **Watermark Tool**: Text and logo watermarks with 6-anchor positioning and tiled repeating patterns.
7. **Watermark Remover**: Interactive brush canvas with Telea boundary inpainting algorithm.
