# ToolHub — Ultimate Image & Document Suite

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/PriyanshuDas607/ToolHub)

**ToolHub** is an all-in-one private client-side image editor, format converter, and AI-powered studio with enterprise-grade OCR & watermark removal.

- **Live Production URL (Vercel):** [https://toolhub-blush-phi.vercel.app](https://toolhub-blush-phi.vercel.app)
- **GitHub Repository:** [https://github.com/PriyanshuDas607/ToolHub](https://github.com/PriyanshuDas607/ToolHub)

---

## ✨ Features

- **Watermark & Object Remover (AI Auto)**: Automatically detect and erase repeating stock watermarks, camera icons, logos, and text with zero blur using directional inpainting.
- **Universal Converter & OCR Engine**:
  - Scanned PDF to Searchable Sandwich PDF (100% design intact)
  - Scanned/Digital PDF to Editable Word (`.docx`)
  - Image to Editable Word (`.docx`)
  - Word (`.docx`) to Exact PDF
- **Compress Image**: High-ratio client-side WebP/JPEG compression with batch ZIP export.
- **Resize Image**: Smart aspect-ratio resizing.
- **AI Upscaler**: 2x and 4x super-resolution detail sharpening.
- **Background Remover**: Instant client-side AI transparent cutout.
- **Photo Editor**: Professional lighting, filters, crop, rotate, and stamps.

---

## 🚀 Deployment

### 1. Frontend (Vercel)
The frontend is built with React + Vite and deployed to Vercel:
- **Production URL:** [https://toolhub-blush-phi.vercel.app](https://toolhub-blush-phi.vercel.app)

### 2. Backend (Render with OCR & Docker)
The backend is a FastAPI engine with complete Tesseract OCR, Poppler, OpenCV, and LibreOffice pre-installed inside a Docker container.

Click the **Deploy to Render** button above or link your GitHub repo [PriyanshuDas607/ToolHub](https://github.com/PriyanshuDas607/ToolHub) on [dashboard.render.com](https://dashboard.render.com). Render will automatically detect `render.yaml` and deploy the Docker service!

---

## 💻 Local Development

### 1. Frontend
```bash
npm install
npm run dev
```
Runs at `http://localhost:5173/`

### 2. Backend Engine
```bash
cd toolshub-engine
# Windows:
run_engine.bat
# Or Python:
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
API Documentation available at `http://127.0.0.1:8000/docs`
