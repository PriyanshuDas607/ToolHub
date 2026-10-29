import os
import cv2
import numpy as np
import pytesseract
from app.pipeline.sub2_preprocess import full_preprocess_pipeline
from app.pipeline.sub7_style_reconstructor import reconstruct_styled_docx

# Try importing PaddleOCR PPStructure; fallback to Tesseract + Style Reconstructor
try:
    from paddleocr import PPStructure
    from paddleocr.ppstructure.recovery.recovery_to_doc import sorted_layout_boxes, convert_info_docx
    layout_engine = PPStructure(recovery=True, lang='en', show_log=False)
except Exception:
    layout_engine = None

def extract_ocr_boxes_tesseract(image: np.ndarray, lang: str = "eng") -> list:
    """
    Extracts text bounding boxes and line structures using Tesseract image_to_data.
    Returns: [{'bbox': [x1, y1, x2, y2], 'text': str}, ...]
    """
    data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
    n_boxes = len(data['text'])
    
    # Group words by (block_num, par_num, line_num)
    lines_map = {}
    for i in range(n_boxes):
        text = data['text'][i].strip()
        conf = int(data['conf'][i])
        if not text or conf < 25:
            continue
            
        key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
        
        if key not in lines_map:
            lines_map[key] = {
                'x1': x, 'y1': y,
                'x2': x + w, 'y2': y + h,
                'words': [text]
            }
        else:
            lines_map[key]['x1'] = min(lines_map[key]['x1'], x)
            lines_map[key]['y1'] = min(lines_map[key]['y1'], y)
            lines_map[key]['x2'] = max(lines_map[key]['x2'], x + w)
            lines_map[key]['y2'] = max(lines_map[key]['y2'], y + h)
            lines_map[key]['words'].append(text)
            
    ocr_boxes = []
    for line_info in lines_map.values():
        full_line = " ".join(line_info['words']).strip()
        if full_line:
            ocr_boxes.append({
                'bbox': [line_info['x1'], line_info['y1'], line_info['x2'], line_info['y2']],
                'text': full_line
            })
            
    return ocr_boxes

def convert_image_to_Editable_docx(image_path: str, output_dir: str, job_id: str, lang: str = "eng") -> str:
    """
    iLoveIMG Style Image-to-Word with Style & Geometry Reconstruction:
    1. Preprocesses image (deskew, shadow removal).
    2. Extracts OCR bounding boxes with coordinate geometry.
    3. Reconstructs exact font size, bold, color, paragraph spacing, and 2-column tables.
    """
    raw_img = cv2.imread(image_path)
    clean_img = full_preprocess_pipeline(raw_img)
    output_docx_path = os.path.join(output_dir, f"{job_id}_ocr.docx")

    # If PaddleOCR PP-Structure is available and works, try it
    if layout_engine is not None:
        try:
            h, w, _ = clean_img.shape
            result = layout_engine(clean_img)
            sorted_boxes = sorted_layout_boxes(result, w)
            convert_info_docx(clean_img, sorted_boxes, output_dir, job_id)
            if os.path.exists(output_docx_path):
                return output_docx_path
        except Exception:
            pass

    # High-accuracy Style & Geometry Reconstruction fallback
    ocr_boxes = extract_ocr_boxes_tesseract(clean_img, lang=lang)
    return reconstruct_styled_docx(clean_img, ocr_boxes, output_docx_path, dpi=300)
