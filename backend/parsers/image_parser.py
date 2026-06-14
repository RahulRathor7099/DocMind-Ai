"""
DocMind AI - Image Parser
OCR extraction from image files (PNG, JPG, JPEG)
"""

import os
import shutil
from PIL import Image
from parsers.ocr_engine import run_ocr_on_image
from utils.config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


def parse_image(file_path: str, filename: str, document_id: int) -> dict:
    """
    Parse an image file using OCR.
    
    Args:
        file_path: Path to image file
        filename: Original filename
        document_id: Database document ID
        
    Returns:
        Unified document dict with single page
    """
    try:
        # Copy image to page images directory
        page_images_dir = os.path.join(settings.UPLOAD_DIR, "pages", str(document_id))
        os.makedirs(page_images_dir, exist_ok=True)

        page_image_path = os.path.join(page_images_dir, "page_1.png")

        # Convert to PNG if needed
        with Image.open(file_path) as img:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(page_image_path, "PNG")

        # Run OCR on the image
        extracted_text = run_ocr_on_image(page_image_path)

        logger.info(f"OCR on image '{filename}': {len(extracted_text)} chars extracted")

        return {
            "document_name": filename,
            "total_pages": 1,
            "pages": [{
                "page_number": 1,
                "extracted_text": extracted_text,
                "page_image_path": page_image_path,
                "tables": [],
                "ocr_applied": True,
            }],
        }

    except Exception as e:
        logger.error(f"Image parsing failed for '{filename}': {e}")
        return {"document_name": filename, "total_pages": 0, "pages": []}
