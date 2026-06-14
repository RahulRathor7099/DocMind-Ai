"""
parsers/pdf_parser.py
---------------------
Extracts text, tables, and page images from PDF files.

Strategy
--------
1. Open the PDF with pdfplumber for text and table extraction.
2. Convert each page to a PNG image with pdf2image (poppler required on PATH).
3. For pages where the extracted text is too short (scanned/image-only PDFs),
   flag them so the OCR engine can be applied downstream.

Return format
-------------
::

    {
        "document_name": str,
        "total_pages": int,
        "pages": [
            {
                "page_number": int,          # 1-indexed
                "extracted_text": str,
                "page_image_path": str,      # absolute path to PNG
                "has_tables": bool,
                "table_data": list[dict],    # [] if no tables
                "needs_ocr": bool,
            },
            ...
        ]
    }
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import pdfplumber
from pdf2image import convert_from_path
from PIL import Image

from parsers.ocr_engine import should_use_ocr
from parsers.table_extractor import extract_tables_from_page
from utils.config import settings
from utils.file_utils import ensure_dir
from utils.logger import get_logger

logger = get_logger(__name__)

# Resolution for page image rendering (DPI)
PAGE_IMAGE_DPI = 150


def _save_page_image(
    pil_image: Image.Image,
    document_id: int,
    page_number: int,
) -> str:
    """
    Save a PIL Image as a PNG and return its absolute path.

    Parameters
    ----------
    pil_image : PIL.Image.Image
        Rendered page image.
    document_id : int
        Database document ID (used to namespace the output directory).
    page_number : int
        1-indexed page number.

    Returns
    -------
    str
        Absolute file path to the saved PNG.
    """
    output_dir = os.path.join(settings.pages_dir, str(document_id))
    ensure_dir(output_dir)
    image_path = os.path.join(output_dir, f"page_{page_number}.png")
    pil_image.save(image_path, format="PNG", optimize=True)
    logger.debug(f"Saved page image: {image_path}")
    return image_path


def parse_pdf(
    file_path: str,
    document_id: int = 0,
    document_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parse a PDF file and extract structured content page by page.

    Parameters
    ----------
    file_path : str
        Absolute path to the PDF file.
    document_id : int
        Database document ID for namespacing image output directories.
    document_name : str, optional
        Friendly document name.  Defaults to the file basename.

    Returns
    -------
    dict
        Structured extraction result (see module docstring for schema).

    Raises
    ------
    FileNotFoundError
        If *file_path* does not exist.
    RuntimeError
        If pdfplumber cannot open the file.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    doc_name = document_name or Path(file_path).name
    pages_data: List[Dict[str, Any]] = []

    # ── Render all pages to images via pdf2image ───────────────────────────
    page_images: List[Image.Image] = []
    try:
        page_images = convert_from_path(
            file_path,
            dpi=PAGE_IMAGE_DPI,
            fmt="png",
            thread_count=2,
        )
        logger.info(f"Rendered {len(page_images)} page image(s) from {doc_name}")
    except Exception as exc:
        logger.warning(
            f"pdf2image rendering failed (Poppler may not be installed): {exc}. "
            "Page images will be unavailable."
        )

    # ── Extract text and tables with pdfplumber ────────────────────────────
    try:
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)

            for page_index, page in enumerate(pdf.pages):
                page_number = page_index + 1

                # --- Text extraction ---
                try:
                    extracted_text: str = page.extract_text() or ""
                except Exception as exc:
                    logger.warning(f"Text extraction failed on page {page_number}: {exc}")
                    extracted_text = ""

                # --- Table extraction ---
                tables: List[Dict] = []
                has_tables = False
                try:
                    tables = extract_tables_from_page(page)
                    has_tables = bool(tables)
                except Exception as exc:
                    logger.warning(f"Table extraction failed on page {page_number}: {exc}")

                # --- Page image ---
                image_path: Optional[str] = None
                if page_index < len(page_images):
                    try:
                        image_path = _save_page_image(
                            page_images[page_index], document_id, page_number
                        )
                    except Exception as exc:
                        logger.warning(f"Could not save page image {page_number}: {exc}")

                # --- OCR flag ---
                needs_ocr = should_use_ocr(extracted_text)

                pages_data.append(
                    {
                        "page_number": page_number,
                        "extracted_text": extracted_text,
                        "page_image_path": image_path,
                        "has_tables": has_tables,
                        "table_data": tables,
                        "needs_ocr": needs_ocr,
                    }
                )

                logger.debug(
                    f"Page {page_number}/{total_pages}: "
                    f"{len(extracted_text)} chars, "
                    f"tables={has_tables}, needs_ocr={needs_ocr}"
                )

    except Exception as exc:
        logger.error(f"pdfplumber failed to open {file_path}: {exc}")
        raise RuntimeError(f"Failed to parse PDF: {exc}") from exc

    logger.info(
        f"PDF parsing complete: {doc_name} — {total_pages} page(s)"
    )

    return {
        "document_name": doc_name,
        "total_pages": total_pages,
        "pages": pages_data,
    }
