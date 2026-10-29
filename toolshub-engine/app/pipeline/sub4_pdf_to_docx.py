import os
from pdf2docx import Converter
from app.pipeline.sub1_ingest import is_pdf_scanned
from app.pipeline.sub3_ocr_pdf import build_searchable_sandwich_pdf

def convert_pdf_to_docx_smart(input_pdf_path: str, output_docx_path: str, lang: str = "eng") -> str:
    """
    Smart Router:
    1. Agar Digital PDF hai -> Tuned Heuristic Vector-to-Flow conversion.
    2. Agar Scanned PDF hai -> Pehle Sandwich OCR layer banata hai, fir layout 
       bounding boxes ke saath DOCX me convert karta hai.
    """
    scanned = is_pdf_scanned(input_pdf_path)
    working_pdf = input_pdf_path
    temp_ocr_pdf = None

    if scanned:
        temp_ocr_pdf = input_pdf_path.replace(".pdf", "_temp_ocr.pdf")
        build_searchable_sandwich_pdf(input_pdf_path, temp_ocr_pdf, lang=lang)
        working_pdf = temp_ocr_pdf

    # Calibrated layout parameters taaki spacing aur alignment kharab na ho
    cv = Converter(working_pdf)
    cv.convert(
        output_docx_path,
        start=0,
        end=None,
        multi_processing=True,
        cpu_count=4,
        # Spacing & Alignment Tuning Parameters:
        connected_border_tolerance=0.5,      # Table borders accurately jodta hai
        max_border_width=6.0,                # Thick table lines detect karta hai
        line_overlap_threshold=0.9,          # Overlapping text lines ko merge karta hai
        line_break_width_ratio=0.5,          # Paragraph vs new-line accurately decide karta hai
        line_break_free_space_ratio=0.1,     # Unnecessary line breaks rokta hai
        line_separate_threshold=5.0,         # Column separation detect karta hai
        new_paragraph_free_space_ratio=0.85
    )
    cv.close()

    if temp_ocr_pdf and os.path.exists(temp_ocr_pdf):
        os.remove(temp_ocr_pdf)

    return output_docx_path
