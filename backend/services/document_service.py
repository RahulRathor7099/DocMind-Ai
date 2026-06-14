"""
services/document_service.py
-----------------------------
Main orchestrator for the full document processing pipeline.

Processing stages
-----------------
1. ``uploaded``             – Initial state set by the upload route.
2. ``parsing``              – File routed to the correct parser.
3. ``ocr_processing``       – OCR applied to scanned/image pages.
4. ``classifying``          – LLM document classification.
5. ``creating_embeddings``  – Text chunked, embedded, FAISS index built.
6. ``indexed``              – Processing complete; document ready for RAG.
7. ``failed``               – Unrecoverable error (message stored in DB).

All DB writes use explicit ``db.commit()`` calls so status updates are
immediately visible to the polling endpoint even during long-running stages.
"""

import datetime
import json
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.database import (
    Document,
    DocumentClassification,
    EmbeddingsMetadata,
    ParsedPage,
)
from parsers.file_router import route_file
from parsers.ocr_engine import run_ocr_on_image, should_use_ocr
from rag.chunker import chunk_document_pages
from rag.embeddings import generate_embeddings, get_embedding_model
from rag.vector_store import create_faiss_index, save_index
from services.classification_service import classify_document
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ── Status helpers ─────────────────────────────────────────────────────────

def _set_status(db: Session, document: Document, status: str, error: Optional[str] = None) -> None:
    """
    Update the document processing status in the database and commit.

    Parameters
    ----------
    db : Session
        Active database session.
    document : Document
        ORM Document instance to update.
    status : str
        New status string.
    error : str, optional
        Error message (only for ``"failed"`` status).
    """
    document.status = status
    if error:
        document.error_message = error
    if status == "indexed":
        document.processed_at = datetime.datetime.utcnow()
    db.commit()
    logger.info(f"Document {document.id} status → '{status}'")


# ── Stage implementations ──────────────────────────────────────────────────

def _save_parsed_pages(
    db: Session,
    document: Document,
    pages: List[Dict[str, Any]],
) -> None:
    """
    Persist parsed page records to the database.

    Existing pages for this document are deleted first to allow
    reprocessing without duplicates.

    Parameters
    ----------
    db : Session
        Active database session.
    document : Document
        Parent document ORM instance.
    pages : list[dict]
        Page dicts from the parser output.
    """
    # Remove stale pages
    db.query(ParsedPage).filter(ParsedPage.document_id == document.id).delete()

    for page_data in pages:
        table_data = page_data.get("table_data") or []
        table_json: Optional[str] = None
        if table_data:
            try:
                table_json = json.dumps(table_data, ensure_ascii=False)
            except (TypeError, ValueError):
                table_json = None

        page_record = ParsedPage(
            document_id=document.id,
            page_number=page_data.get("page_number", 0),
            extracted_text=page_data.get("extracted_text", ""),
            page_image_path=page_data.get("page_image_path"),
            has_tables=bool(page_data.get("has_tables", False)),
            tables_data=table_json,
            ocr_applied=page_data.get("ocr_applied", page_data.get("ocr_used", False)),
            word_count=len((page_data.get("extracted_text", "") or "").split()),
        )
        db.add(page_record)

    db.commit()
    logger.debug(f"Saved {len(pages)} parsed page(s) for document {document.id}")


def _save_classification(
    db: Session,
    document: Document,
    classification: Dict[str, Any],
) -> None:
    """
    Persist classification results to the database.

    Parameters
    ----------
    db : Session
        Active database session.
    document : Document
        Parent document ORM instance.
    classification : dict
        Classification dict from ``classification_service.classify_document``.
    """
    # Delete existing classification if any
    db.query(DocumentClassification).filter(
        DocumentClassification.document_id == document.id
    ).delete()

    record = DocumentClassification(
        document_id=document.id,
        document_type=classification.get("document_type"),
        topic=classification.get("topic"),
        sensitivity_level=classification.get("sensitivity_level"),
        language=classification.get("language"),
        domain=classification.get("domain"),
        summary=classification.get("summary"),
        business_relevance=classification.get("business_relevance"),
        confidence_score=classification.get("confidence_score", 0.0),
        raw_classification=json.dumps(classification, ensure_ascii=False),
    )
    db.add(record)
    db.commit()
    logger.debug(f"Saved classification for document {document.id}")


def _save_embeddings_metadata(
    db: Session,
    document: Document,
    index_path: str,
    chunks_path: str,
    total_chunks: int,
    vector_dim: int,
) -> None:
    """
    Persist FAISS index metadata to the database.

    Parameters
    ----------
    db : Session
        Active database session.
    document : Document
        Parent document ORM instance.
    index_path : str
        Absolute path to the saved FAISS index.
    chunks_path : str
        Absolute path to the saved chunks pickle.
    total_chunks : int
        Number of vectors in the index.
    vector_dim : int
        Embedding dimension.
    """
    from models.database import EmbeddingsMetadata

    # Delete existing metadata
    db.query(EmbeddingsMetadata).filter(
        EmbeddingsMetadata.document_id == document.id
    ).delete()

    record = EmbeddingsMetadata(
        document_id=document.id,
        index_path=index_path,
        chunks_path=chunks_path,
        total_chunks=total_chunks,
        embedding_model=settings.EMBEDDING_MODEL,
        embedding_dim=vector_dim,
    )
    db.add(record)
    db.commit()
    logger.debug(
        f"Saved embeddings metadata for document {document.id}: "
        f"{total_chunks} chunks, dim={vector_dim}"
    )


# ── Main orchestrator ──────────────────────────────────────────────────────

async def process_document(
    document_id: int,
    file_path: str,
    filename: str,
    db: Session,
) -> None:
    """
    Orchestrate the complete document processing pipeline.

    This coroutine is called from a FastAPI ``BackgroundTasks`` handler.
    It updates the document status at each stage and writes all extracted
    data to the database.

    Parameters
    ----------
    document_id : int
        Database ID of the document to process.
    file_path : str
        Absolute path to the uploaded file on disk.
    filename : str
        Original filename (used for classification and display).
    db : Session
        SQLAlchemy session for database access.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        logger.error(f"process_document: document {document_id} not found in DB")
        return

    logger.info(f"Starting processing pipeline for document {document_id}: {filename}")

    try:
        # ── Stage 1: Parsing ───────────────────────────────────────────────
        _set_status(db, document, "parsing")

        parse_result = route_file(
            file_path=file_path,
            filename=filename,
            document_id=document_id,
        )
        pages: List[Dict[str, Any]] = parse_result.get("pages", [])
        total_pages: int = parse_result.get("total_pages", len(pages))

        document.total_pages = total_pages
        db.commit()

        logger.info(
            f"Document {document_id}: parsed {total_pages} page(s)"
        )

        # ── Stage 2: OCR (if needed) ───────────────────────────────────────
        needs_ocr_count = sum(1 for p in pages if p.get("needs_ocr", False))

        if needs_ocr_count > 0:
            _set_status(db, document, "ocr_processing")
            logger.info(
                f"Document {document_id}: running OCR on "
                f"{needs_ocr_count}/{total_pages} page(s)"
            )

            for page in pages:
                if not page.get("needs_ocr", False):
                    continue

                image_path = page.get("page_image_path")
                if image_path and os.path.isfile(image_path):
                    ocr_text = run_ocr_on_image(image_path)
                    if ocr_text:
                        page["extracted_text"] = ocr_text
                        page["ocr_used"] = True
                        logger.debug(
                            f"OCR page {page['page_number']}: "
                            f"{len(ocr_text)} chars"
                        )

        # Save parsed pages (with OCR text if applied)
        _save_parsed_pages(db, document, pages)

        # ── Stage 3: Classification ────────────────────────────────────────
        _set_status(db, document, "classifying")

        # Collect text from first few pages for classification sample
        sample_texts = []
        for p in pages[:5]:
            t = (p.get("extracted_text") or "").strip()
            if t:
                sample_texts.append(t)
        full_sample = "\n\n".join(sample_texts)

        classification = await classify_document(
            text_sample=full_sample,
            document_name=filename,
        )
        _save_classification(db, document, classification)

        # ── Stage 4: Embeddings & FAISS ───────────────────────────────────
        _set_status(db, document, "creating_embeddings")

        chunks = chunk_document_pages(
            pages=pages,
            document_name=filename,
            document_id=document_id,
        )

        if not chunks:
            logger.warning(
                f"Document {document_id}: no text chunks produced. "
                "Document may be empty or consist entirely of images."
            )
            _set_status(db, document, "indexed")
            return

        # Generate embeddings
        chunk_texts = [c["text"] for c in chunks]
        embeddings = generate_embeddings(chunk_texts)

        # Build and save FAISS index
        index = create_faiss_index(embeddings)
        index_path, chunks_path = save_index(index, chunks, document_id)

        # Get embedding dimension
        embedding_model = get_embedding_model()
        vector_dim = embedding_model.get_sentence_embedding_dimension() or embeddings.shape[1]

        _save_embeddings_metadata(
            db=db,
            document=document,
            index_path=index_path,
            chunks_path=chunks_path,
            total_chunks=len(chunks),
            vector_dim=int(vector_dim),
        )

        # ── Stage 5: Complete ──────────────────────────────────────────────
        _set_status(db, document, "indexed")

        logger.info(
            f"Document {document_id} processing complete: "
            f"{total_pages} pages, {len(chunks)} chunks, "
            f"classification={classification.get('document_type')}"
        )

    except Exception as exc:
        error_msg = f"Processing failed: {type(exc).__name__}: {str(exc)}"
        logger.error(f"Document {document_id} {error_msg}", exc_info=True)
        _set_status(db, document, "failed", error=error_msg)
