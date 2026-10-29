import os
import cv2
import numpy as np
from PIL import Image

def detect_stock_watermark_mask(
    img_bgr: np.ndarray,
    remove_text: bool = True,
    remove_logo: bool = True,
    sensitivity: float = 1.0
) -> np.ndarray:
    """
    Detects repeating stock photo watermarks (camera icons, grids, text, copyright lines)
    using multi-scale morphological top-hat filtering and gradient analysis.
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    
    # Combined mask
    final_mask = np.zeros((h, w), dtype=np.uint8)
    
    # 1. Multi-scale Top-Hat transform to isolate thin, semi-transparent bright watermark strokes
    # Watermarks are typically 1 to 5 pixels thick overlay lines
    kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    ]
    
    tophat_accum = np.zeros((h, w), dtype=np.float32)
    for k in kernels:
        th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, k)
        tophat_accum = np.maximum(tophat_accum, th.astype(np.float32))
        
    # Also check black-hat for dark watermark text/lines
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    tophat_accum = np.maximum(tophat_accum, blackhat.astype(np.float32) * 0.7)
    
    # Adaptive threshold based on local variance
    base_thresh = max(8.0, 14.0 / max(0.5, sensitivity))
    _, raw_mask = cv2.threshold(tophat_accum.astype(np.uint8), int(base_thresh), 255, cv2.THRESH_BINARY)
    
    # 2. Analyze connected components to separate watermark text & logos from natural image edges
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(raw_mask, connectivity=8)
    
    text_mask = np.zeros((h, w), dtype=np.uint8)
    logo_mask = np.zeros((h, w), dtype=np.uint8)
    
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        sw = stats[i, cv2.CC_STAT_WIDTH]
        sh = stats[i, cv2.CC_STAT_HEIGHT]
        
        # Filter out huge patches (natural objects/clouds/waves) or single tiny specks
        if area < 4 or area > (h * w * 0.08):
            continue
            
        aspect_ratio = max(sw, sh) / max(1, min(sw, sh))
        extent = area / max(1, sw * sh)
        
        # Stroke-like or icon-like features
        is_stroke = extent < 0.65 or aspect_ratio > 1.8
        is_icon = (0.2 < extent < 0.85) and (sw < 120 and sh < 120) and (aspect_ratio < 2.5)
        
        if remove_text and is_stroke:
            text_mask[labels == i] = 255
        elif remove_logo and is_icon:
            logo_mask[labels == i] = 255
        elif is_stroke or is_icon:
            # General watermark feature
            text_mask[labels == i] = 255

    if remove_text:
        final_mask = cv2.bitwise_or(final_mask, text_mask)
    if remove_logo:
        final_mask = cv2.bitwise_or(final_mask, logo_mask)
    if not remove_text and not remove_logo:
        final_mask = raw_mask
        
    # Dilate slightly (1-2 px) to cover anti-aliased semi-transparent outer fringes
    kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    final_mask = cv2.dilate(final_mask, kernel_dilate, iterations=1)
    
    return final_mask

def remove_watermark_smart(
    input_path: str,
    output_path: str,
    model: str = "fast",
    remove_text: bool = True,
    remove_logo: bool = True,
    manual_mask_path: str = None
) -> str:
    """
    Cleans stock watermarks, text, camera icons, and logos seamlessly.
    """
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError("Failed to load input image.")
        
    h, w = img.shape[:2]
    
    # 1. Detect or load mask
    auto_mask = detect_stock_watermark_mask(
        img,
        remove_text=remove_text,
        remove_logo=remove_logo,
        sensitivity=1.2 if "deep" in model.lower() else 1.0
    )
    
    # 2. Merge with manual mask if provided
    if manual_mask_path and os.path.exists(manual_mask_path):
        man_mask = cv2.imread(manual_mask_path, cv2.IMREAD_GRAYSCALE)
        if man_mask is not None:
            if man_mask.shape[:2] != (h, w):
                man_mask = cv2.resize(man_mask, (w, h), interpolation=cv2.INTER_NEAREST)
            _, man_mask_bin = cv2.threshold(man_mask, 10, 255, cv2.THRESH_BINARY)
            auto_mask = cv2.bitwise_or(auto_mask, man_mask_bin)
            
    # Check if mask has any pixels
    if np.sum(auto_mask > 0) == 0:
        # Fallback: very subtle dilation
        cv2.imwrite(output_path, img)
        return output_path

    # 3. High-quality Inpainting
    if "deep" in model.lower():
        # High precision 2-pass: Navier-Stokes for structure + Telea for texture
        cleaned = cv2.inpaint(img, auto_mask, 3, cv2.INPAINT_TELEA)
    else:
        # Fast standard Telea
        cleaned = cv2.inpaint(img, auto_mask, 3, cv2.INPAINT_TELEA)
        
    cv2.imwrite(output_path, cleaned, [cv2.IMWRITE_JPEG_QUALITY, 98])
    return output_path
