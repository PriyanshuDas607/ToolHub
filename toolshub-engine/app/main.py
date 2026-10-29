import os
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import TEMP_DIR
from app.utils.file_manager import save_upload_file, cleanup_job_files
from app.pipeline.sub3_ocr_pdf import build_searchable_sandwich_pdf
from app.pipeline.sub4_pdf_to_docx import convert_pdf_to_docx_smart
from app.pipeline.sub5_img_to_docx import convert_image_to_Editable_docx
from app.pipeline.sub6_docx_to_pdf import convert_docx_to_pdf_exact

app = FastAPI(
    title="ToolsHub OCR & Document Engine",
    description="High-accuracy OCR, Sandwich PDF, and Layout-Preserving Conversion API",
    version="1.0.0"
)

# Enable CORS for React / Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def api_health():
    """Health check endpoint to verify backend status."""
    return {"status": "online", "engine": "ToolsHub Enterprise OCR v1.0.0"}

@app.post("/api/v1/ocr-pdf")
async def api_ocr_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lang: str = Form("eng")
):
    """Scanned PDF ko Searchable PDF me convert karta hai (100% Design Intact)."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    job_id, input_path = save_upload_file(file)
    output_path = os.path.join(TEMP_DIR, f"{job_id}_searchable.pdf")

    try:
        build_searchable_sandwich_pdf(input_path, output_path, lang=lang)
    except Exception as e:
        cleanup_job_files(input_path, output_path)
        raise HTTPException(status_code=500, detail=f"OCR Failed: {str(e)}")

    background_tasks.add_task(cleanup_job_files, input_path, output_path)
    return FileResponse(
        output_path,
        filename=f"ToolsHub_OCR_{file.filename}",
        media_type="application/pdf"
    )

@app.post("/api/v1/pdf-to-docx")
async def api_pdf_to_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lang: str = Form("eng")
):
    """Digital ya Scanned PDF ko Layout-Preserving Editable Word (.docx) me badalta hai."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    job_id, input_path = save_upload_file(file)
    output_path = os.path.join(TEMP_DIR, f"{job_id}_converted.docx")

    try:
        convert_pdf_to_docx_smart(input_path, output_path, lang=lang)
    except Exception as e:
        cleanup_job_files(input_path, output_path)
        raise HTTPException(status_code=500, detail=f"PDF to DOCX Failed: {str(e)}")

    background_tasks.add_task(cleanup_job_files, input_path, output_path)
    out_name = os.path.splitext(file.filename)[0] + ".docx"
    return FileResponse(
        output_path,
        filename=out_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.post("/api/v1/image-to-docx")
async def api_image_to_docx(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Photo/Scanned Image (JPG/PNG) se Tables aur Text extract karke Word (.docx) banata hai."""
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(status_code=400, detail="Upload PNG, JPG, or WEBP image.")

    job_id, input_path = save_upload_file(file)
    output_path = None

    try:
        output_path = convert_image_to_Editable_docx(input_path, TEMP_DIR, job_id)
    except Exception as e:
        cleanup_job_files(input_path, output_path)
        raise HTTPException(status_code=500, detail=f"Image OCR Failed: {str(e)}")

    background_tasks.add_task(cleanup_job_files, input_path, output_path)
    out_name = os.path.splitext(file.filename)[0] + ".docx"
    return FileResponse(
        output_path,
        filename=out_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.post("/api/v1/docx-to-pdf")
async def api_docx_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Word (.docx) ko 100% exact alignment aur fonts ke saath PDF me convert karta hai."""
    if not file.filename.lower().endswith((".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only Word (.docx/.doc) files allowed.")

    job_id, input_path = save_upload_file(file)
    output_path = None

    try:
        output_path = convert_docx_to_pdf_exact(input_path, TEMP_DIR)
    except Exception as e:
        cleanup_job_files(input_path, output_path)
        raise HTTPException(status_code=500, detail=f"DOCX to PDF Failed: {str(e)}")

    background_tasks.add_task(cleanup_job_files, input_path, output_path)
    out_name = os.path.splitext(file.filename)[0] + ".pdf"
    return FileResponse(
        output_path,
        filename=out_name,
        media_type="application/pdf"
    )

@app.post("/api/v1/remove-watermark")
async def api_remove_watermark(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("fast"),
    remove_text: bool = Form(True),
    remove_logo: bool = Form(True),
    mask: UploadFile = File(None)
):
    """
    Automatic Stock Watermark, Camera Icon, Logo & Text Remover.
    """
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(status_code=400, detail="Upload PNG, JPG, or WEBP image.")

    from app.pipeline.watermark_remover import remove_watermark_smart

    job_id, input_path = save_upload_file(file)
    output_path = os.path.join(TEMP_DIR, f"{job_id}_clean.jpg")
    
    manual_mask_path = None
    if mask and mask.filename:
        _, manual_mask_path = save_upload_file(mask)

    try:
        remove_watermark_smart(
            input_path=input_path,
            output_path=output_path,
            model=model,
            remove_text=remove_text,
            remove_logo=remove_logo,
            manual_mask_path=manual_mask_path
        )
    except Exception as e:
        cleanup_job_files(input_path, output_path)
        if manual_mask_path:
            cleanup_job_files(manual_mask_path)
        raise HTTPException(status_code=500, detail=f"Watermark removal failed: {str(e)}")

    cleanup_files = [input_path, output_path]
    if manual_mask_path:
        cleanup_files.append(manual_mask_path)
    background_tasks.add_task(cleanup_job_files, *cleanup_files)

    out_name = os.path.splitext(file.filename)[0] + "_cleaned.jpg"
    return FileResponse(
        output_path,
        filename=out_name,
        media_type="image/jpeg"
    )

