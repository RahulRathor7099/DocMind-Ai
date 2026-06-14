"""
DocMind AI - Security Service
File validation, sanitization, and security checks
"""

import os
import re
import hashlib
from utils.logger import get_logger

logger = get_logger(__name__)

# Allowed file types
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "txt", "docx", "doc"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

# Dangerous file patterns to block
BLOCKED_PATTERNS = [
    r"\.exe$", r"\.dll$", r"\.bat$", r"\.sh$", r"\.php$",
    r"\.js$", r"\.py$", r"\.rb$", r"\.pl$", r"\.cmd$",
]


def validate_file_type(filename: str, content_type: str) -> tuple[bool, str]:
    """
    Validate file type by extension and MIME type.
    
    Returns:
        (is_valid, error_message)
    """
    ext = os.path.splitext(filename)[1].lower().lstrip(".")

    # Check extension
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '.{ext}' is not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"

    # Check for blocked patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, filename, re.IGNORECASE):
            return False, "This file type is blocked for security reasons."

    # Check MIME type (be lenient if content_type is generic)
    if content_type and content_type != "application/octet-stream":
        if content_type not in ALLOWED_MIME_TYPES:
            logger.warning(f"Unexpected MIME type '{content_type}' for file '{filename}'")
            # Allow but log warning — MIME types can be unreliable from browsers

    return True, ""


def validate_file_size(file_size: int, max_mb: int = 50) -> tuple[bool, str]:
    """
    Validate file size.
    
    Args:
        file_size: File size in bytes
        max_mb: Maximum allowed size in MB
        
    Returns:
        (is_valid, error_message)
    """
    max_bytes = max_mb * 1024 * 1024
    if file_size > max_bytes:
        size_mb = file_size / (1024 * 1024)
        return False, f"File size {size_mb:.1f}MB exceeds maximum {max_mb}MB limit."
    if file_size == 0:
        return False, "File is empty."
    return True, ""


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and special char attacks.
    
    Returns:
        Safe filename with only alphanumeric, dots, hyphens, underscores
    """
    # Remove path components
    filename = os.path.basename(filename)
    # Keep only safe characters
    name, ext = os.path.splitext(filename)
    safe_name = re.sub(r"[^\w\-_\. ]", "_", name)
    safe_name = safe_name.strip(". ")[:100]  # max 100 chars
    if not safe_name:
        safe_name = "document"
    return f"{safe_name}{ext.lower()}"


def check_pdf_for_malicious(file_path: str) -> bool:
    """
    Basic check for malicious PDF content.
    Looks for JavaScript actions and launch commands.
    
    Returns:
        True if file appears safe, False if suspicious
    """
    try:
        with open(file_path, "rb") as f:
            content = f.read(10240)  # Read first 10KB

        # Check for common malicious patterns
        suspicious_patterns = [
            b"/JavaScript",
            b"/JS ",
            b"/Launch",
            b"/OpenAction",
            b"/AA ",
            b"eval(",
        ]

        for pattern in suspicious_patterns:
            if pattern in content:
                logger.warning(f"Suspicious PDF pattern found: {pattern}")
                return False

        return True

    except Exception as e:
        logger.error(f"PDF malice check failed: {e}")
        return True  # Assume safe if check fails


def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of a file for integrity verification."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def is_safe_upload(
    filename: str,
    content_type: str,
    file_size: int = 0,
    file_path: str = "",
    max_mb: int = 50,
) -> tuple[bool, str]:
    """
    Perform a unified safety check on upload metadata.
    
    Returns:
        (is_safe, reason)
    """
    is_valid_type, err = validate_file_type(filename, content_type)
    if not is_valid_type:
        return False, err
        
    if file_size > 0:
        is_valid_size, err = validate_file_size(file_size, max_mb)
        if not is_valid_size:
            return False, err
            
    if file_path and os.path.isfile(file_path):
        ext = os.path.splitext(filename)[1].lower().lstrip(".")
        if ext == "pdf":
            if not check_pdf_for_malicious(file_path):
                return False, "Malicious patterns found in PDF content."
                
    return True, ""

