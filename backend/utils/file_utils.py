"""
DocMind AI - File Utilities
Helper functions for file operations
"""

import os
import uuid
import hashlib
from pathlib import Path


def get_file_extension(filename: str) -> str:
    """Get lowercase file extension without dot."""
    return Path(filename).suffix.lower().lstrip(".")


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename preserving the extension."""
    ext = get_file_extension(original_filename)
    unique_id = uuid.uuid4().hex
    return f"{unique_id}.{ext}" if ext else unique_id


def ensure_dir(directory: str) -> str:
    """Create directory if it doesn't exist. Returns the path."""
    os.makedirs(directory, exist_ok=True)
    return directory


def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of file for integrity verification."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def safe_delete(file_path: str) -> bool:
    """Safely delete a file, returning True if deleted, False if not found."""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False
