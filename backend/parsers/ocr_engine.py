"""
parsers/ocr_engine.py
---------------------
Optical Character Recognition utilities built on pytesseract + Pillow.

Functions
---------
run_ocr_on_image(image_path)  → Preprocesses and OCRs an image file.
should_use_ocr(text, min_chars) → Heuristic to detect scanned-only pages.
"""

import os
from typing import Optional

import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

from utils.logger import get_logger

logger = get_logger(__name__)

# Tesseract custom configuration for best accuracy on document scans
TESSERACT_CONFIG = (
    "--oem 3 "          # LSTM neural-net OCR engine
    "--psm 6 "          # Assume uniform block of text
    "-c preserve_interword_spaces=1"
)


# ── Image preprocessing ────────────────────────────────────────────────────

def _preprocess_image(image: Image.Image) -> Image.Image:
    """
    Apply a sequence of image-processing operations to improve OCR accuracy.

    Steps
    -----
    1. Convert to greyscale.
    2. Upscale small images to at least 1500 px wide (Tesseract works best
       at ~300 DPI, which for A4 is ~2480 px).
    3. Increase contrast.
    4. Apply an unsharp-mask to sharpen edges.
    5. Binarise with a fixed threshold.

    Parameters
    ----------
    image : PIL.Image.Image
        Input image (any mode).

    Returns
    -------
    PIL.Image.Image
        Preprocessed greyscale/binary image ready for OCR.
    """
    # 1. Greyscale
    img = image.convert("L")

    # 2. Upscale if too small
    width, height = img.size
    if width < 1500:
        scale = 1500 / width
        img = img.resize(
            (int(width * scale), int(height * scale)),
            Image.LANCZOS,
        )

    # 3. Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    # 4. Sharpen
    img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))

    # 5. Binarise (simple threshold at mid-point)
    threshold = 128
    img = img.point(lambda px: 255 if px > threshold else 0, "L")

    return img


# ── Public API ─────────────────────────────────────────────────────────────

def run_ocr_on_image(image_path: str) -> str:
    """
    Run Tesseract OCR on the image at *image_path* and return extracted text.

    The image is preprocessed (greyscale → contrast → binarise) before
    being passed to Tesseract to maximise recognition accuracy.

    Parameters
    ----------
    image_path : str
        Absolute path to a PNG or JPEG image file.

    Returns
    -------
    str
        Extracted text, stripped of leading/trailing whitespace.
        Returns an empty string on failure rather than raising.
    """
    if not os.path.isfile(image_path):
        logger.error(f"OCR target image not found: {image_path}")
        return ""

    try:
        raw_image = Image.open(image_path)
        processed_image = _preprocess_image(raw_image)
        text: str = pytesseract.image_to_string(
            processed_image,
            config=TESSERACT_CONFIG,
            lang="eng",
        )
        result = text.strip()
        logger.debug(
            f"OCR extracted {len(result)} chars from {os.path.basename(image_path)}"
        )
        return result

    except pytesseract.TesseractNotFoundError:
        logger.error(
            "Tesseract is not installed or not on PATH.  "
            "Install it from https://github.com/UB-Mannheim/tesseract/wiki"
        )
        return ""
    except Exception as exc:
        logger.warning(f"OCR failed on {image_path}: {exc}")
        return ""


def run_ocr_on_pil_image(image: Image.Image) -> str:
    """
    Run Tesseract OCR directly on a PIL Image object.

    Parameters
    ----------
    image : PIL.Image.Image
        In-memory image (e.g. a page rendered by pdf2image).

    Returns
    -------
    str
        Extracted text.
    """
    try:
        processed = _preprocess_image(image)
        text = pytesseract.image_to_string(
            processed,
            config=TESSERACT_CONFIG,
            lang="eng",
        )
        return text.strip()
    except Exception as exc:
        logger.warning(f"OCR on PIL image failed: {exc}")
        return ""


def should_use_ocr(extracted_text: str, min_chars: int = 50) -> bool:
    """
    Determine whether a page needs OCR based on the length of already-extracted text.

    A page is considered 'scanned' (image-only) if the native text layer
    contains fewer than *min_chars* printable characters after stripping
    whitespace — a common signature of scanned documents where the text
    layer is absent or contains only whitespace artefacts.

    Parameters
    ----------
    extracted_text : str
        Text extracted by the native PDF text layer.
    min_chars : int
        Minimum character count to consider the text layer adequate.
        Defaults to 50.

    Returns
    -------
    bool
        ``True``  → OCR is recommended.
        ``False`` → The existing text layer is sufficient.
    """
    if not extracted_text:
        return True

    # Count only printable non-whitespace characters
    printable_count = sum(1 for c in extracted_text if c.strip())
    return printable_count < min_chars
