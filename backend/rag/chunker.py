"""
DocMind AI - Text Chunker
Smart document chunking preserving page-level metadata for citations
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter
from utils.config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


def chunk_document_pages(pages: list, document_name: str, document_id: int) -> list:
    """
    Chunk all pages of a document into semantic text chunks with metadata.
    
    Args:
        pages: List of page dicts {page_number, extracted_text, page_image_path}
        document_name: Original document filename
        document_id: Database document ID
        
    Returns:
        List of chunk dicts: {text, metadata: {document_name, document_id, page_number, chunk_index}}
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    all_chunks = []
    chunk_index = 0

    for page in pages:
        page_number = page.get("page_number", 1)
        text = page.get("extracted_text", "").strip()

        if not text or len(text) < 20:
            continue

        # Split this page's text into chunks
        page_chunks = splitter.split_text(text)

        for chunk_text in page_chunks:
            if len(chunk_text.strip()) < 10:
                continue

            all_chunks.append({
                "text": chunk_text.strip(),
                "metadata": {
                    "document_name": document_name,
                    "document_id": document_id,
                    "page_number": page_number,
                    "chunk_index": chunk_index,
                    "page_image_path": page.get("page_image_path", ""),
                }
            })
            chunk_index += 1

    logger.info(
        f"Chunked '{document_name}' (doc_id={document_id}): "
        f"{len(pages)} pages → {len(all_chunks)} chunks"
    )
    return all_chunks
