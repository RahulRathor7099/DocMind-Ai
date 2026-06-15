"""
rag/embeddings.py
-----------------
Optimized embedding service for DocMind AI.

Uses Google Gemini API (gemini-embedding-2) by default to stay within
Render's 512MB RAM limit by avoiding loading PyTorch.
Falls back to local Sentence-Transformers via lazy loading.
"""

from typing import List
import numpy as np
import google.generativeai as genai

from utils.config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)

# Configure Gemini if key is present
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


class GeminiEmbeddingWrapper:
    """Wrapper that mimics SentenceTransformer interface for dimension lookup."""
    def get_sentence_embedding_dimension(self) -> int:
        return 3072  # gemini-embedding-2 dimension


# Singleton model instance for sentence_transformers (lazy loaded)
_model = None


def get_embedding_model():
    """
    Return the embedding model instance or wrapper.

    If GEMINI_API_KEY is available, returns a wrapper for Gemini embedding-2.
    Otherwise, lazy-loads and returns a SentenceTransformer instance.
    """
    global _model
    
    if settings.GEMINI_API_KEY:
        logger.info("Using Google Gemini API (gemini-embedding-2) for embeddings")
        return GeminiEmbeddingWrapper()
        
    if _model is None:
        logger.info(f"Loading local embedding model: {settings.EMBEDDING_MODEL}")
        # Lazy import to prevent PyTorch from loading when Gemini API is used
        from sentence_transformers import SentenceTransformer as LocalSentenceTransformer
        _model = LocalSentenceTransformer(settings.EMBEDDING_MODEL)
        dim = _model.get_sentence_embedding_dimension()
        logger.info(f"Local embedding model loaded — dimension: {dim}")
    return _model


def generate_embeddings(texts: List[str]) -> np.ndarray:
    """
    Generate embedding vectors for a list of texts.

    Uses Gemini API if API key is present, otherwise falls back to local
    SentenceTransformer (lazy loaded).
    """
    if not texts:
        dim = 3072 if settings.GEMINI_API_KEY else 384
        logger.warning("generate_embeddings called with empty text list")
        return np.zeros((0, dim), dtype=np.float32)

    # Replace empty or pure whitespace texts with a placeholder to avoid API errors
    cleaned_texts = [t if t.strip() else " " for t in texts]

    if settings.GEMINI_API_KEY:
        logger.debug(f"Generating Gemini embeddings for {len(texts)} text(s)")
        try:
            response = genai.embed_content(
                model="models/gemini-embedding-2",
                content=cleaned_texts,
                task_type="retrieval_document"
            )
            # Ensure return is a numpy float32 array
            embeddings = np.array(response["embedding"], dtype=np.float32)
            
            # L2 normalise for cosine similarity via dot product / inner product
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1.0, norms)
            normalized = embeddings / norms
            return normalized.astype(np.float32)
        except Exception as exc:
            logger.error(f"Gemini embedding API failed: {exc}. Falling back to local model.")

    # Fallback to local SentenceTransformer
    model = get_embedding_model()
    logger.debug(f"Generating local embeddings for {len(texts)} text(s)")
    try:
        # If we had a fallback from a failed Gemini API call, get_embedding_model() might have returned wrapper
        if isinstance(model, GeminiEmbeddingWrapper):
            from sentence_transformers import SentenceTransformer as LocalSentenceTransformer
            global _model
            if _model is None:
                _model = LocalSentenceTransformer(settings.EMBEDDING_MODEL)
            model = _model

        embeddings = model.encode(
            cleaned_texts,
            batch_size=64,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings.astype(np.float32)
    except Exception as exc:
        logger.error(f"Local embedding generation failed: {exc}")
        raise RuntimeError(f"Embedding generation error: {exc}") from exc


def embed_single(text: str) -> np.ndarray:
    """
    Generate a single embedding vector for a query text.
    """
    if settings.GEMINI_API_KEY:
        try:
            response = genai.embed_content(
                model="models/gemini-embedding-2",
                content=text or " ",
                task_type="retrieval_query"
            )
            # Handle single response list structure
            embedding = np.array(response["embedding"], dtype=np.float32)
            if embedding.ndim == 2:
                embedding = embedding[0]
            
            # L2 normalise
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            return embedding
        except Exception as exc:
            logger.error(f"Gemini query embedding failed: {exc}, falling back to general pipeline")
            
    embeddings = generate_embeddings([text])
    return embeddings[0]

