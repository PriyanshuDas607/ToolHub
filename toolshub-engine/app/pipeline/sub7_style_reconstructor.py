import os
import cv2
import numpy as np
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def detect_style_from_crop(crop_img: np.ndarray) -> tuple[bool, tuple[int, int, int]]:
    """
    Cropped word/line image se detect karta hai ki text BOLD hai ya nahi,
    aur text ka exact RGB Color kya hai using OpenCV Otsu thresholding & ink density.
    """
    if crop_img is None or crop_img.size == 0:
        return False, (0, 0, 0)

    # Convert to grayscale
    if len(crop_img.shape) == 3:
        gray = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop_img.copy()

    # Otsu thresholding: text pixels (foreground) ko background se alag karo
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    except Exception:
        return False, (0, 0, 0)

    total_pixels = float(binary.size)
    if total_pixels == 0:
        return False, (0, 0, 0)

    # 1. BOLD Detection (Ink Density / Stroke Thickness Ratio)
    ink_ratio = np.sum(binary > 0) / total_pixels
    is_bold = ink_ratio > 0.32  # >32% ink density indicates bold stroke

    # 2. Text Color Detection (Foreground pixels ka median BGR color)
    mask = binary > 0
    if np.any(mask) and len(crop_img.shape) == 3:
        b = int(np.median(crop_img[:, :, 0][mask]))
        g = int(np.median(crop_img[:, :, 1][mask]))
        r = int(np.median(crop_img[:, :, 2][mask]))
        # Clean look: agar dark gray ya near-black hai to pure black (0,0,0)
        if r < 60 and g < 60 and b < 60:
            r, g, b = 0, 0, 0
    else:
        r, g, b = 0, 0, 0

    return is_bold, (r, g, b)


def make_table_borders_invisible(table):
    """
    Side-by-side text blocks (e.g. 2-column header, resume address, invoice) 
    ko invisible grid me rakhne ke liye border hatata hai (OpenXML w:val='nil').
    """
    tblPr = table._tbl.tblPr
    tblBorders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'nil')
        tblBorders.append(border)
    tblPr.append(tblBorders)


def detect_side_by_side_pairs(ocr_boxes: list) -> list:
    """
    Detects pairs or groups of bounding boxes that share overlapping Y vertical space
    (such as Left: Candidate Name, Right: Phone Number / Date) and groups them
    into a structured row format for invisible 2-column tables.
    Returns: list of entries, either a single box dict or a 'two_column' dict.
    """
    if not ocr_boxes:
        return []

    # Sort boxes primarily top-to-bottom, then left-to-right
    sorted_boxes = sorted(ocr_boxes, key=lambda b: (b['bbox'][1], b['bbox'][0]))
    merged_items = []
    skip_indices = set()

    for i in range(len(sorted_boxes)):
        if i in skip_indices:
            continue

        item_a = sorted_boxes[i]
        xa1, ya1, xa2, ya2 = item_a['bbox']
        ha = max(10, ya2 - ya1)

        found_partner = None
        for j in range(i + 1, len(sorted_boxes)):
            if j in skip_indices:
                continue
            item_b = sorted_boxes[j]
            xb1, yb1, xb2, yb2 = item_b['bbox']
            hb = max(10, yb2 - yb1)

            # Check if vertical overlap is significant (>60% overlap or vertical distance is small)
            y_overlap = min(ya2, yb2) - max(ya1, yb1)
            vertical_aligned = (y_overlap > 0.5 * min(ha, hb)) or (abs(ya1 - yb1) < 0.4 * min(ha, hb))

            # Check horizontal separation (clearly distinct columns, not merged word)
            horizontal_separated = (xb1 > xa2 + 30) or (xa1 > xb2 + 30)

            if vertical_aligned and horizontal_separated:
                found_partner = (j, item_b)
                break

        if found_partner:
            j_idx, item_b = found_partner
            skip_indices.add(j_idx)
            # Order left-to-right
            left_item = item_a if item_a['bbox'][0] <= item_b['bbox'][0] else item_b
            right_item = item_b if item_a['bbox'][0] <= item_b['bbox'][0] else item_a
            merged_items.append({
                'type': 'two_column',
                'left': left_item,
                'right': right_item,
                'y_top': min(ya1, item_b['bbox'][1]),
                'y_bottom': max(ya2, item_b['bbox'][3])
            })
        else:
            merged_items.append({
                'type': 'single',
                'item': item_a,
                'y_top': ya1,
                'y_bottom': ya2
            })

    # Sort final layout top-to-bottom
    merged_items.sort(key=lambda x: x['y_top'])
    return merged_items


def build_page_styled_elements(doc: Document, image: np.ndarray, ocr_boxes: list, dpi: int = 300):
    """
    Processes a single page image and its OCR bounding boxes to append exact
    typography, colors, headings, margins, and side-by-side invisible tables to `doc`.
    """
    img_h, img_w = image.shape[:2]
    layout_elements = detect_side_by_side_pairs(ocr_boxes)

    prev_y2 = 0
    current_para = None

    for elem in layout_elements:
        if elem['type'] == 'two_column':
            # Reset current paragraph reference before table
            current_para = None
            left_item = elem['left']
            right_item = elem['right']

            lx1, ly1, lx2, ly2 = [int(v) for v in left_item['bbox']]
            rx1, ry1, rx2, ry2 = [int(v) for v in right_item['bbox']]

            l_text = left_item['text'].strip()
            r_text = right_item['text'].strip()

            if not l_text and not r_text:
                continue

            # Calculate font sizes
            l_font_pt = max(8, min(round(((ly2 - ly1) / float(dpi)) * 72.0 * 0.82), 36))
            r_font_pt = max(8, min(round(((ry2 - ry1) / float(dpi)) * 72.0 * 0.82), 36))

            # Crop & styles
            l_crop = image[max(0, ly1):min(img_h, ly2), max(0, lx1):min(img_w, lx2)]
            r_crop = image[max(0, ry1):min(img_h, ry2), max(0, rx1):min(img_w, rx2)]
            l_bold, (lr, lg, lb) = detect_style_from_crop(l_crop)
            r_bold, (rr, rg, rb) = detect_style_from_crop(r_crop)

            # Add 1x2 borderless table
            table = doc.add_table(rows=1, cols=2)
            make_table_borders_invisible(table)

            # Left Cell
            c_left = table.cell(0, 0)
            c_left.width = Inches(4.0)
            p_l = c_left.paragraphs[0]
            p_l.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p_l.paragraph_format.space_before = Pt(2)
            p_l.paragraph_format.space_after = Pt(2)
            r_l = p_l.add_run(l_text)
            r_l.font.name = "Calibri"
            r_l.font.size = Pt(l_font_pt)
            r_l.bold = l_bold or (l_font_pt >= 16)
            r_l.font.color.rgb = RGBColor(lr, lg, lb)

            # Right Cell
            c_right = table.cell(0, 1)
            c_right.width = Inches(3.0)
            p_r = c_right.paragraphs[0]
            p_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_r.paragraph_format.space_before = Pt(2)
            p_r.paragraph_format.space_after = Pt(2)
            r_r = p_r.add_run(r_text)
            r_r.font.name = "Calibri"
            r_r.font.size = Pt(r_font_pt)
            r_r.bold = r_bold or (r_font_pt >= 16)
            r_r.font.color.rgb = RGBColor(rr, rg, rb)

            prev_y2 = elem['y_bottom']
            continue

        # Single paragraph/box handling
        item = elem['item']
        x1, y1, x2, y2 = [int(v) for v in item['bbox']]
        text = item['text'].strip()
        if not text:
            continue

        box_h = max(10, y2 - y1)
        box_w = max(10, x2 - x1)

        # 1. Exact Font Size (Pixels to Word Points)
        font_pt = round((box_h / float(dpi)) * 72.0 * 0.82)
        font_pt = max(8, min(font_pt, 36))

        # 2. Bold and RGB Color from crop
        crop = image[max(0, y1):min(img_h, y2), max(0, x1):min(img_w, x2)]
        is_bold, (r, g, b) = detect_style_from_crop(crop)

        # 3. Alignment Detection
        left_margin_px = x1
        right_margin_px = img_w - x2
        alignment = WD_ALIGN_PARAGRAPH.LEFT

        if abs(left_margin_px - right_margin_px) < (img_w * 0.08) and box_w < (img_w * 0.8):
            alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif left_margin_px > (img_w * 0.55):
            alignment = WD_ALIGN_PARAGRAPH.RIGHT

        # 4. Paragraph Grouping & Vertical Space Before
        vertical_gap = y1 - prev_y2 if prev_y2 > 0 else 0

        if current_para is not None and vertical_gap < (box_h * 0.7) and current_para.alignment == alignment:
            # Same paragraph continuous flow
            run = current_para.add_run(" " + text)
        else:
            current_para = doc.add_paragraph()
            current_para.alignment = alignment

            # Exact Top Spacing
            if vertical_gap > (box_h * 0.7) and prev_y2 > 0:
                space_before_pt = min(36, round((vertical_gap / float(dpi)) * 72.0 * 0.6))
                current_para.paragraph_format.space_before = Pt(space_before_pt)
            else:
                current_para.paragraph_format.space_before = Pt(0)

            current_para.paragraph_format.space_after = Pt(2)

            # Left Indentation for nested blocks
            if alignment == WD_ALIGN_PARAGRAPH.LEFT and left_margin_px > (img_w * 0.12):
                indent_inches = ((left_margin_px / float(img_w)) * 8.27) - 0.6
                if indent_inches > 0.1:
                    current_para.paragraph_format.left_indent = Inches(min(indent_inches, 3.5))

            run = current_para.add_run(text)

        # 5. Apply Font Styling
        run.font.name = "Calibri"
        run.font.size = Pt(font_pt)
        run.bold = is_bold or (font_pt >= 16)
        run.font.color.rgb = RGBColor(r, g, b)

        prev_y2 = y2


def reconstruct_styled_docx(image: np.ndarray, ocr_boxes: list, output_docx_path: str, dpi: int = 300) -> str:
    """
    Single-page Style & Geometry Reconstruction:
    Image aur OCR coordinates se exact design, font-size, bold, colors,
    margins aur side-by-side alignment wala DOCX banata hai.
    """
    doc = Document()

    # Page Margins (A4 Standard)
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.left_margin = Inches(0.6)
    section.right_margin = Inches(0.6)
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)

    build_page_styled_elements(doc, image, ocr_boxes, dpi=dpi)

    doc.save(output_docx_path)
    return output_docx_path


def reconstruct_multipage_styled_docx(pages_data: list, output_docx_path: str, dpi: int = 300) -> str:
    """
    Multi-page Style & Geometry Reconstruction:
    pages_data: list of dicts -> [{'image': np.ndarray, 'ocr_boxes': list}, ...]
    Har page par section margins and page breaks maintain karta hai.
    """
    doc = Document()

    for idx, page in enumerate(pages_data):
        if idx == 0:
            section = doc.sections[0]
        else:
            section = doc.add_section()

        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)

        build_page_styled_elements(doc, page['image'], page['ocr_boxes'], dpi=dpi)

    doc.save(output_docx_path)
    return output_docx_path
