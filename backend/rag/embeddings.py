"""
rag/embeddings.py
-----------------
Sentence-Transformers embedding generation for DocMind AI RAG pipeline.

Uses a singleton SentenceTransformer model loaded once at startup to
avoid repeated costly model initialisation.

Public API
----------
- get_embedding_model()       → SentenceTransformer (singleton)
- generate_embeddings(texts)  → np.ndarray  shape (N, D)
- embed_single(text)          → np.ndarray  shape (D,)
"""

from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ── Singleton model instance ───────────────────────────────────────────────
_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    """
    Return the shared SentenceTransformer model instance.

    The model is loaded on first call and cached for subsequent calls.
    The model name is taken from ``settings.EMBEDDING_MODEL``
    (default: ``all-MiniLM-L6-v2``).

    Returns
    -------
    SentenceTransformer
        Loaded embedding model ready for inference.
    """
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        dim = _model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model loaded — dimension: {dim}")
    return _model


def generate_embeddings(texts: List[str]) -> np.ndarray:
    """
    Generate embedding vectors for a list of texts.

    Parameters
    ----------
    texts : list[str]
        Input strings to embed.  Empty strings are allowed; they produce
        a zero-like vector from the model.

    Returns
    -------
    np.ndarray
        Float32 array of shape ``(len(texts), embedding_dim)``.
        Returns an empty array of shape ``(0, embedding_dim)`` if
        *texts* is empty.

    Raises
    ------
    RuntimeError
        If the embedding model fails to produce output.
    """
    model = get_embedding_model()

    if not texts:
        dim = model.get_sentence_embedding_dimension() or 384
        logger.warning("generate_embeddings called with empty text list")
        return np.zeros((0, dim), dtype=np.float32)

    logger.debug(f"Generating embeddings for {len(texts)} text(s)")
    try:
        embeddings = model.encode(
            texts,
            batch_size=64,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2-normalise for cosine similarity via dot product
        )
        embeddings = embeddings.astype(np.float32)
        logger.debug(f"Embeddings shape: {embeddings.shape}")
        return embeddings
    except Exception as exc:
        logger.error(f"Embedding generation failed: {exc}")
        raise RuntimeError(f"Embedding generation error: {exc}") from exc


def embed_single(text: str) -> np.ndarray:
    """
    Generate a single embedding vector for *text*.

    A convenience wrapper around :func:`generate_embeddings` for the
    common case of embedding a query string.

    Parameters
    ----------
    text : str
        Input text.

    Returns
    -------
    np.ndarray
        Float32 array of shape ``(embedding_dim,)`` — a 1-D vector.
    """
    embeddings = generate_embeddings([text])
    return embeddings[0]
