# Technical Requirements Document (TECH_REQ.md) — v2.0
## Universal Converter & Image Studio Architecture

### 1. Architectural Strategy
- **Framework**: React 18 + Vite.
- **Styling**: Precision Vanilla CSS based on industrial design principles (Linear/CloudConvert aesthetic). Subdued slate/zinc palette, razor-sharp 1px borders, high readability typography.
- **Privacy Model**: 100% In-Browser Execution. No network hops or cloud uploads.

---

### 2. Multi-Engine Converter Architecture (`src/utils/converters/`)
1. **`imageConverter.js`**:
   - Canvas 2D / ImageBitmap decoder.
   - Outputs: `image/jpeg`, `image/png`, `image/webp`.
   - Binary ICO generator (packs BMP/PNG data with multi-resolution ICONDIR & ICONDIRENTRY directory headers).
   - SVG rasterizer & vector scaler.

2. **`documentConverter.js`**:
   - `jspdf` integration for PDF generation from plain text, markdown, HTML, and raster images.
   - DOCX reader via `jszip` extracting `word/document.xml`, parsing paragraphs, and converting to PDF/TXT/MD.
   - Markdown to HTML renderer with standard heading, list, code block syntax parsing.

3. **`videoAudioConverter.js`**:
   - Video pipeline: HTML5 `<video>` decoding + Canvas frame capture / `MediaRecorder` or audio track isolation.
   - Audio pipeline: `AudioContext.decodeAudioData` into PCM AudioBuffer, converted to standard 16-bit PCM WAV container format, or WebM audio via `MediaRecorder`.
   - Video to GIF/WAV converter.

4. **`archiveConverter.js`**:
   - `jszip` for reading & creating ZIP archives.
   - Custom UStar POSIX TAR format encoder/decoder (512-byte block tape archive structure).
   - `DecompressionStream('gzip')` & `CompressionStream('gzip')` for `.tar.gz` packing and unpacking.

5. **`dataCodeConverter.js`**:
   - JSON ↔ YAML via `yaml` package.
   - JSON ↔ CSV via RFC 4180 delimiter / quote-escaped parser & generator.
   - JSON ↔ XML via browser native `DOMParser` and `XMLSerializer`.
