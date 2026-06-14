"""
api/document_routes.py
-----------------------
Endpoints for retrieving detailed document information, pages, and images.

Endpoints
---------
GET  /document/{document_id}                        – Full document info + classification
GET  /document/{document_id}/pages                  – All parsed pages
GET  /document/{document_id}/page/{page_num}/image  – Serve a page image file
"""

import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from auth.auth_handler import get_current_user
from models.database import Document, DocumentClassification, ParsedPage, User, get_db
from models.schemas import (
    ClassificationResponse,
    DocumentResponse,
    MessageResponse,
    ParsedPageResponse,
)
from typing import List

from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Document Details"])


# ── GET /document/{document_id} ────────────────────────────────────────────

@router.get(
    "/document/{document_id}",
    response_model=DocumentResponse,
    summary="Get full document details including classification",
)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """
    Retrieve a document record with its LLM-generated classification.

    Parameters
    ----------
    document_id : int
        Database ID of the document.

    Returns
    -------
    DocumentResponse
        Full document record including nested ``classification`` field.

    Raises
    ------
    HTTPException(404)
        If the document is not found or does not belong to the current user.
    """
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )

    # Eagerly load classification if present
    classification = (
        db.query(DocumentClassification)
        .filter(DocumentClassification.document_id == document_id)
        .first()
    )

    doc_response = DocumentResponse.model_validate(document)
    if classification:
        doc_response.classification = ClassificationResponse.model_validate(classification)

    return doc_response


# ── GET /document/{document_id}/pages ─────────────────────────────────────

@router.get(
    "/document/{document_id}/pages",
    response_model=List[ParsedPageResponse],
    summary="Get all parsed pages for a document",
)
def get_document_pages(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ParsedPageResponse]:
    """
    Return all parsed pages for a document in page-number order.

    Each page includes its extracted text, image path, OCR flag, and
    any table data.

    Raises
    ------
    HTTPException(404)
        If the document is not found or does not belong to the current user.
    HTTPException(400)
        If the document has not yet completed parsing.
    """
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )

    if document.status in ("uploaded", "parsing"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is still being processed (status: {document.status}).",
        )

    pages = (
        db.query(ParsedPage)
        .filter(ParsedPage.document_id == document_id)
        .order_by(ParsedPage.page_number)
        .all()
    )

    return [ParsedPageResponse.model_validate(p) for p in pages]


# ── GET /document/{document_id}/page/{page_num}/image ─────────────────────

@router.get(
    "/document/{document_id}/page/{page_num}/image",
    summary="Serve a rendered page image",
    response_class=FileResponse,
)
def get_page_image(
    document_id: int,
    page_num: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Return the PNG image for a specific page of a document.

    The image is served directly as a ``FileResponse`` with content-type
    ``image/png``.

    Parameters
    ----------
    document_id : int
        Database ID of the document.
    page_num : int
        1-indexed page number.

    Raises
    ------
    HTTPException(403)
        If the document does not belong to the current user.
    HTTPException(404)
        If the document, page record, or image file is not found.
    """
    # Verify ownership
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied or document not found.",
        )

    # Retrieve page record
    page = (
        db.query(ParsedPage)
        .filter(
            ParsedPage.document_id == document_id,
            ParsedPage.page_number == page_num,
        )
        .first()
    )
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page {page_num} not found for document {document_id}.",
        )

    image_path = page.page_image_path
    if not image_path or not os.path.isfile(image_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Page image not available for page {page_num}. "
                "The document may be text-only or not yet fully processed."
            ),
        )

    logger.debug(
        f"Serving page image: doc={document_id}, page={page_num}, "
        f"path={image_path}"
    )

    return FileResponse(
        path=image_path,
        media_type="image/png",
        filename=f"document_{document_id}_page_{page_num}.png",
    )
