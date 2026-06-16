"""
api/upload_routes.py
--------------------
File upload and document management endpoints.

Endpoints
---------
POST   /upload                    – Upload a file, trigger async processing
GET    /documents                 – List all documents for the current user
DELETE /document/{document_id}    – Delete a document and all its files
GET    /document/{document_id}/status – Poll document processing status
"""

import os
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from auth.auth_handler import get_current_user
from models.database import Document, User, get_db
from models.schemas import (
    DocumentListResponse,
    DocumentResponse,
    DocumentStatus,
    MessageResponse,
    UploadResponse,
)
from services.document_service import process_document
from services.security_service import is_safe_upload, sanitize_filename
from services.storage_service import delete_document_files, save_upload_file
from utils.config import settings
from utils.file_utils import calculate_file_hash, get_file_extension
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Documents"])

# Status → approximate progress percentage
STATUS_PROGRESS: dict = {
    "uploaded": 5,
    "parsing": 20,
    "ocr_processing": 40,
    "classifying": 60,
    "creating_embeddings": 80,
    "indexed": 100,
    "failed": 0,
}


# ── POST /upload ───────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a document for processing",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Document to upload (PDF, DOCX, PNG, JPG, TXT)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Accept a file upload, validate it, create a database record, save it
    to disk, and trigger asynchronous processing in the background.

    Returns immediately with a ``document_id`` that can be used to poll
    ``/document/{id}/status``.

    Raises
    ------
    HTTPException(400)
        If the file type, size, or content is invalid.
    HTTPException(413)
        If the file exceeds the maximum allowed size.
    """
    original_filename = file.filename or "unknown"
    content_type = file.content_type or "application/octet-stream"

    logger.info(
        f"Upload received: '{original_filename}' "
        f"({content_type}) from user {current_user.id}"
    )

    # ── Read file size (stream into memory is avoided; use content-length) ─
    # Read first chunk to check if file is accessible, then reset
    first_chunk = await file.read(1024)
    await file.seek(0)
    if not first_chunk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Security: type + MIME check (before writing to disk) ──────────────
    ext = get_file_extension(original_filename)
    safe, reason = is_safe_upload(
        filename=original_filename,
        content_type=content_type,
        file_size=0,  # Size check done after save below
        file_path="",  # Content check done after save below
        max_mb=settings.MAX_FILE_SIZE_MB,
    )
    if not safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason,
        )

    # ── Create DB record (status = uploaded) ───────────────────────────────
    safe_name = sanitize_filename(original_filename)
    new_doc = Document(
        user_id=current_user.id,
        filename=safe_name,
        original_filename=original_filename,
        file_path="",  # Will be updated after save
        file_size=0,
        file_type=ext,
        status="uploaded",
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    document_id = new_doc.id

    # ── Save file to disk ──────────────────────────────────────────────────
    try:
        file_path, unique_name, file_size = await save_upload_file(file, current_user.id)
    except Exception as exc:
        db.delete(new_doc)
        db.commit()
        logger.error(f"Failed to save upload for document {document_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save the uploaded file. Please try again.",
        )

    # ── File size check ────────────────────────────────────────────────────
    if not validate_file_size_after_save(file_size, settings.MAX_FILE_SIZE_MB):
        os.remove(file_path)
        db.delete(new_doc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
        )

    # ── PDF malicious content check ────────────────────────────────────────
    if ext == "pdf":
        from services.security_service import check_pdf_for_malicious
        if not check_pdf_for_malicious(file_path):
            os.remove(file_path)
            db.delete(new_doc)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded PDF contains potentially malicious content.",
            )

    # ── Compute file hash (for deduplication) ─────────────────────────────
    try:
        file_hash = calculate_file_hash(file_path)
    except Exception:
        file_hash = None

    # ── Update DB record with final metadata ───────────────────────────────
    new_doc.file_path = file_path
    new_doc.file_size = file_size
    db.commit()

    logger.info(
        f"Document {document_id} saved: {file_path} "
        f"({file_size} bytes, hash={file_hash})"
    )

    # ── Trigger background processing ──────────────────────────────────────
    background_tasks.add_task(
        _run_processing_task,
        document_id=document_id,
        file_path=file_path,
        filename=original_filename,
    )

    return UploadResponse(
        document_id=document_id,
        filename=original_filename,
        status="uploaded",
        message="File accepted and queued for processing. Use /document/{id}/status to poll.",
    )


def _run_processing_task(document_id: int, file_path: str, filename: str) -> None:
    """
    Synchronous wrapper that creates a new DB session and runs the async
    processing pipeline via asyncio.

    Called from FastAPI BackgroundTasks (which runs in a thread pool).
    """
    import asyncio

    from models.database import SessionLocal

    db = SessionLocal()
    try:
        asyncio.run(
            process_document(
                document_id=document_id,
                file_path=file_path,
                filename=filename,
                db=db,
            )
        )
    except Exception as exc:
        logger.error(
            f"Background processing task failed for document {document_id}: {exc}",
            exc_info=True,
        )
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "failed"
                document.error_message = f"Background task failed: {exc}"
                db.commit()
        except Exception as db_exc:
            logger.error(f"Failed to update document status to failed in DB: {db_exc}")
    finally:
        db.close()


def validate_file_size_after_save(file_size: int, max_mb: int) -> bool:
    """Return True if file_size is within the allowed limit."""
    return file_size <= max_mb * 1024 * 1024


# ── GET /documents ─────────────────────────────────────────────────────────

@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List all documents for the current user",
)
def list_documents(
    skip: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=20, ge=1, le=100, description="Max documents to return"),
    status_filter: Optional[str] = Query(default=None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    """
    Return a paginated list of all documents uploaded by the current user.

    Supports optional filtering by processing status.
    """
    query = db.query(Document).filter(Document.user_id == current_user.id)

    if status_filter:
        query = query.filter(Document.status == status_filter)

    total = query.count()
    documents = (
        query.order_by(Document.upload_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return DocumentListResponse(
        total=total,
        documents=[DocumentResponse.model_validate(d) for d in documents],
    )


# ── DELETE /document/{document_id} ────────────────────────────────────────

@router.delete(
    "/document/{document_id}",
    response_model=MessageResponse,
    summary="Delete a document and all associated files",
)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Permanently delete a document and remove all associated files
    (uploaded file, page images, FAISS index, chunks pickle).

    Raises
    ------
    HTTPException(404)
        If the document does not exist or does not belong to the current user.
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

    file_path = document.file_path

    # Remove DB record (cascade deletes pages, classification, embeddings)
    db.delete(document)
    db.commit()

    # Remove files from disk
    delete_document_files(
        document_id=document_id,
        file_path=file_path,
    )

    logger.info(
        f"Document {document_id} deleted by user {current_user.id}"
    )

    return MessageResponse(message=f"Document {document_id} successfully deleted.")


# ── GET /document/{document_id}/status ────────────────────────────────────

@router.get(
    "/document/{document_id}/status",
    response_model=DocumentStatus,
    summary="Poll the processing status of a document",
)
def get_document_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentStatus:
    """
    Return the current processing status of a document.

    Intended to be called repeatedly (polled) by the frontend until
    ``status == "indexed"`` or ``status == "failed"``.

    Raises
    ------
    HTTPException(404)
        If the document does not exist or does not belong to the current user.
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

    progress = STATUS_PROGRESS.get(document.status, 0)

    return DocumentStatus(
        document_id=document.id,
        status=document.status,
        error_message=document.error_message,
        progress_pct=progress,
    )
