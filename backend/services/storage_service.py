"""
DocMind AI - Storage Service
File storage management with organized directory structure
"""

import os
import uuid
import shutil
import aiofiles
from fastapi import UploadFile

from utils.config import get_settings
from rag.vector_store import delete_document_index
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


def get_user_upload_dir(user_id: int) -> str:
    """Get upload directory for a specific user."""
    path = os.path.join(settings.UPLOAD_DIR, "documents", str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


def get_page_images_dir(document_id: int) -> str:
    """Get page images directory for a document."""
    path = os.path.join(settings.UPLOAD_DIR, "pages", str(document_id))
    os.makedirs(path, exist_ok=True)
    return path


def get_page_image_path(document_id: int, page_number: int) -> str:
    """Get full path for a specific page image."""
    return os.path.join(
        settings.UPLOAD_DIR, "pages", str(document_id), f"page_{page_number}.png"
    )


async def save_upload_file(upload_file: UploadFile, user_id: int) -> tuple[str, str, int]:
    """
    Save an uploaded file to disk.
    
    Returns:
        Tuple of (file_path, unique_filename, file_size_bytes)
    """
    # Generate unique filename to prevent conflicts
    ext = os.path.splitext(upload_file.filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"

    user_dir = get_user_upload_dir(user_id)
    file_path = os.path.join(user_dir, unique_name)

    # Stream file to disk
    file_size = 0
    async with aiofiles.open(file_path, "wb") as f:
        while True:
            chunk = await upload_file.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            await f.write(chunk)
            file_size += len(chunk)

    logger.info(f"Saved upload: {unique_name} ({file_size / 1024:.1f}KB)")
    return file_path, unique_name, file_size


def delete_document_files(document_id: int, file_path: str = None):
    """
    Delete all files associated with a document:
    - Original uploaded file
    - Page images
    - FAISS index
    """
    # Delete original file
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"Deleted document file: {file_path}")

    # Delete page images directory
    pages_dir = os.path.join(settings.UPLOAD_DIR, "pages", str(document_id))
    if os.path.exists(pages_dir):
        shutil.rmtree(pages_dir)
        logger.info(f"Deleted page images for doc {document_id}")

    # Delete FAISS index
    delete_document_index(document_id)
    logger.info(f"Deleted FAISS index for doc {document_id}")
