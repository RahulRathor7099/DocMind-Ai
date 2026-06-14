"""
DocMind AI - File Router
Routes uploaded files to the correct parser based on file type
"""

import os
from parsers.pdf_parser import parse_pdf
from parsers.docx_parser import parse_docx
from parsers.image_parser import parse_image
from parsers.ocr_engine import should_use_ocr, run_ocr_on_image
from utils.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {
    "pdf": "pdf",
    "docx": "docx",
    "doc": "docx",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "txt": "text",
}


def route_file(file_path: str, filename: str, document_id: int) -> dict:
    """
    Route a file to the appropriate parser.
    
    Returns unified format:
    {
        document_name: str,
        total_pages: int,
        pages: [{page_number, extracted_text, page_image_path, tables, ocr_applied}]
    }
    """
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    file_type = SUPPORTED_EXTENSIONS.get(ext, "unknown")

    logger.info(f"Routing '{filename}' as type: {file_type}")

    if file_type == "pdf":
        return parse_pdf(file_path, document_id=document_id, document_name=filename)
    elif file_type == "docx":
        return parse_docx(file_path, filename, document_id)
    elif file_type == "image":
        return parse_image(file_path, filename, document_id)
    elif file_type == "text":
        return _parse_text(file_path, filename, document_id)
    else:
        logger.warning(f"Unsupported file type: {ext}")
        return {"document_name": filename, "total_pages": 0, "pages": []}


def _parse_text(file_path: str, filename: str, document_id: int) -> dict:
    """Parse plain text files."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # Split into ~1000 char pages
        page_size = 2000
        pages = []
        for i in range(0, max(1, len(content)), page_size):
            chunk = content[i:i + page_size]
            if chunk.strip():
                pages.append({
                    "page_number": (i // page_size) + 1,
                    "extracted_text": chunk,
                    "page_image_path": None,
                    "tables": [],
                    "ocr_applied": False,
                })

        return {
            "document_name": filename,
            "total_pages": len(pages),
            "pages": pages,
        }
    except Exception as e:
        logger.error(f"Text file parsing failed: {e}")
        return {"document_name": filename, "total_pages": 0, "pages": []}
