"""
DocMind AI - Text Chunker
Smart document chunking preserving page-level metadata for citations
"""

from utils.config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class RecursiveCharacterTextSplitter:
    """
    Custom lightweight implementation of RecursiveCharacterTextSplitter to avoid
    importing langchain_text_splitters (which loads sentence_transformers and PyTorch on startup).
    This keeps the memory footprint under 80MB.
    """
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, length_function=len, separators=None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.length_function = length_function
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def split_text(self, text: str) -> list[str]:
        return self._split_text(text, self.separators)

    def _split_text(self, text: str, separators: list[str]) -> list[str]:
        if self.length_function(text) <= self.chunk_size:
            return [text]

        separator = separators[0] if separators else ""
        next_separators = separators[1:] if len(separators) > 1 else []

        if separator:
            splits = text.split(separator)
        else:
            splits = list(text)

        final_chunks = []
        current_chunk = []
        current_length = 0

        for i, s in enumerate(splits):
            s_with_sep = s + (separator if i < len(splits) - 1 else "")
            s_len = self.length_function(s_with_sep)

            if s_len > self.chunk_size:
                if current_chunk:
                    final_chunks.append("".join(current_chunk))
                    current_chunk = []
                    current_length = 0
                sub_splits = self._split_text(s_with_sep, next_separators)
                for ss in sub_splits:
                    final_chunks.append(ss)
            else:
                if current_length + s_len <= self.chunk_size:
                    current_chunk.append(s_with_sep)
                    current_length += s_len
                else:
                    if current_chunk:
                        final_chunks.append("".join(current_chunk))
                    
                    overlap_chunk = []
                    overlap_len = 0
                    for item in reversed(current_chunk):
                        item_len = self.length_function(item)
                        if overlap_len + item_len <= self.chunk_overlap:
                            overlap_chunk.insert(0, item)
                            overlap_len += item_len
                        else:
                            break
                    current_chunk = overlap_chunk + [s_with_sep]
                    current_length = overlap_len + s_len

        if current_chunk:
            final_chunks.append("".join(current_chunk))

        return [c for c in final_chunks if c.strip()]


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
