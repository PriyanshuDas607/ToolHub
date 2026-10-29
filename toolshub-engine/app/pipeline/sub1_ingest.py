import fitz  # PyMuPDF
import numpy as np
import cv2
from app.config import OCR_DPI

def is_pdf_scanned(pdf_path: str) -> bool:
    """
    Check karta hai ki PDF digital hai ya scanned image-based PDF hai.
    Agar digital text 50 characters se kam hai, to use scanned maana jayega.
    """
    doc = fitz.open(pdf_path)
    total_text_len = 0
    for page in doc:
        total_text_len += len(page.get_text("text").strip())
        if total_text_len > 50:
            doc.close()
            return False
    doc.close()
    return True

def pdf_to_high_res_opencv_images(pdf_path: str, dpi: int = OCR_DPI) -> list[np.ndarray]:
    """PDF ke har page ko 300 DPI OpenCV BGR matrix me convert karta hai."""
    doc = fitz.open(pdf_path)
    images = []
    zoom = dpi / 72.0  # Default PDF coordinate space 72 DPI hota hai
    matrix = fitz.Matrix(zoom, zoom)

    for page_index in range(len(doc)):
        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        
        img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 3:
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        images.append(img_np)

    doc.close()
    return images
