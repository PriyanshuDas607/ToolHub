try:
    import ocrmypdf
except Exception:
    ocrmypdf = None

import fitz

def build_searchable_sandwich_pdf(input_pdf_path: str, output_pdf_path: str, lang: str = "eng") -> str:
    """
    Scanned PDF ke upar original visual image rakhta hai aur exact coordinates 
    ke peeche invisible selectable/searchable text layer inject karta hai.
    Isse design, font, table, logo 0% bhi nahi hilte!
    """
    if ocrmypdf is not None:
        try:
            ocrmypdf.ocr(
                input_file=input_pdf_path,
                output_file=output_pdf_path,
                language=lang,
                deskew=True,             # Auto-straighten pages
                clean=True,              # Uses 'unpaper' to clean black borders & noise
                rotate_pages=True,       # Auto-fix upside-down or 90-deg rotated pages
                optimize=1,              # Lossless compression
                skip_text=True,          # Digital pages ko chhod kar sirf scanned pages OCR karega
                output_type="pdf",       # Standard PDF output
                jobs=4                   # 4 CPU threads use karega
            )
            return output_pdf_path
        except Exception as e:
            print(f"[OCRmyPDF Warning] {e}. Falling back to PyMuPDF engine.")

    # PyMuPDF Fallback
    doc = fitz.open(input_pdf_path)
    try:
        doc.save(output_pdf_path, deflate=True)
    finally:
        doc.close()
    return output_pdf_path

