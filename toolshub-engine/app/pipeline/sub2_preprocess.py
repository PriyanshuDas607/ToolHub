import cv2
import numpy as np

def deskew_image(image: np.ndarray) -> np.ndarray:
    """Tedhi (tilted) scanned image ka angle nikal kar use exact 0 degree सीधा karta hai."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    gray_inv = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray_inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return image

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Sirf tab rotate karo jab tilt significant ho (0.2 deg se 15 deg ke beech)
    if 0.2 < abs(angle) < 15.0:
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated
    return image

def remove_shadows_and_enhance(image: np.ndarray) -> np.ndarray:
    """Mobile camera se kheenchi gayi photo se shadows hatata hai aur text sharp karta hai."""
    rgb_planes = cv2.split(image)
    result_norm_planes = []

    for plane in rgb_planes:
        dilated_img = cv2.dilate(plane, np.ones((7, 7), np.uint8))
        bg_img = cv2.medianBlur(dilated_img, 21)
        diff_img = 255 - cv2.absdiff(plane, bg_img)
        norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
        result_norm_planes.append(norm_img)

    shadow_free = cv2.merge(result_norm_planes)
    return shadow_free

def full_preprocess_pipeline(image: np.ndarray) -> np.ndarray:
    """Complete pre-processing: Deskew + Shadow Removal."""
    step1 = deskew_image(image)
    step2 = remove_shadows_and_enhance(step1)
    return step2
