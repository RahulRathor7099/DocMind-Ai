"""
rag/vector_store.py
--------------------
FAISS vector store management for DocMind AI.

Each document gets its own FAISS flat-IP (inner-product) index because
embeddings are L2-normalised, making inner product equivalent to cosine
similarity.

Directory layout
----------------
::

    uploads/faiss/
    ├── {document_id}.index          ← FAISS binary index
    └── {document_id}_chunks.pkl     ← Pickled list of chunk dicts

Public API
----------
- create_faiss_index(embeddings)
- save_index(index, chunks, document_id)
- load_index(document_id)
- search_similar_chunks(query_embedding, document_id, top_k)
- search_across_documents(query_embedding, document_ids, top_k)
- get_document_index_path(document_id) → str
"""

import os
import pickle
from typing import Any, Dict, List, Optional, Tuple

import faiss
import numpy as np

from utils.config import settings
from utils.file_utils import ensure_dir
from utils.logger import get_logger

logger = get_logger(__name__)


# ── Path helpers ───────────────────────────────────────────────────────────

def get_document_index_path(document_id: int) -> str:
    """
    Return the absolute path to the FAISS index file for a document.

    Parameters
    ----------
    document_id : int
        Database document ID.

    Returns
    -------
    str
        Path to ``uploads/faiss/{document_id}.index``.
    """
    return os.path.join(settings.faiss_dir, f"{document_id}.index")


def _get_chunks_path(document_id: int) -> str:
    """Return the path to the pickled chunks list for a document."""
    return os.path.join(settings.faiss_dir, f"{document_id}_chunks.pkl")


# ── Index creation ─────────────────────────────────────────────────────────

def create_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    """
    Build a FAISS IndexFlatIP (cosine similarity via inner product) from embeddings.

    Parameters
    ----------
    embeddings : np.ndarray
        Float32 array of shape ``(N, D)`` with L2-normalised vectors.

    Returns
    -------
    faiss.Index
        Populated FAISS index ready for search.

    Raises
    ------
    ValueError
        If *embeddings* is empty or has the wrong dtype.
    """
    if embeddings.ndim != 2 or embeddings.shape[0] == 0:
        raise ValueError(
            f"Expected 2-D non-empty float32 array, got shape {embeddings.shape}"
        )

    embeddings = embeddings.astype(np.float32)
    dimension = embeddings.shape[1]

    index = faiss.IndexFlatIP(dimension)  # Inner product = cosine when normalised
    index.add(embeddings)

    logger.info(
        f"FAISS IndexFlatIP created: {index.ntotal} vector(s), dim={dimension}"
    )
    return index


# ── Persistence ────────────────────────────────────────────────────────────

def save_index(
    index: faiss.Index,
    chunks: List[Dict[str, Any]],
    document_id: int,
) -> Tuple[str, str]:
    """
    Persist a FAISS index and its associated chunk list to disk.

    Parameters
    ----------
    index : faiss.Index
        Populated FAISS index.
    chunks : list[dict]
        Ordered list of chunk dicts (same order as the embeddings in *index*).
    document_id : int
        Used to name the output files.

    Returns
    -------
    (index_path, chunks_path)
        Absolute paths to the saved files.
    """
    ensure_dir(settings.faiss_dir)

    index_path = get_document_index_path(document_id)
    chunks_path = _get_chunks_path(document_id)

    faiss.write_index(index, index_path)
    logger.info(f"FAISS index saved: {index_path}")

    with open(chunks_path, "wb") as fh:
        pickle.dump(chunks, fh, protocol=pickle.HIGHEST_PROTOCOL)
    logger.info(f"Chunks pickle saved: {chunks_path}")

    return index_path, chunks_path


def load_index(
    document_id: int,
) -> Optional[Tuple[faiss.Index, List[Dict[str, Any]]]]:
    """
    Load a FAISS index and its associated chunks from disk.

    Parameters
    ----------
    document_id : int
        Database document ID.

    Returns
    -------
    (faiss.Index, list[dict]) or None
        Loaded index and chunk list, or ``None`` if either file is missing.
    """
    index_path = get_document_index_path(document_id)
    chunks_path = _get_chunks_path(document_id)

    if not os.path.isfile(index_path) or not os.path.isfile(chunks_path):
        logger.warning(
            f"FAISS index or chunks missing for document {document_id}: "
            f"index_exists={os.path.isfile(index_path)}, "
            f"chunks_exists={os.path.isfile(chunks_path)}"
        )
        return None

    try:
        index = faiss.read_index(index_path)
        with open(chunks_path, "rb") as fh:
            chunks: List[Dict[str, Any]] = pickle.load(fh)

        logger.debug(
            f"Loaded FAISS index for document {document_id}: "
            f"{index.ntotal} vector(s), {len(chunks)} chunk(s)"
        )
        return index, chunks

    except Exception as exc:
        logger.error(f"Failed to load FAISS index for document {document_id}: {exc}")
        return None


# ── Search ─────────────────────────────────────────────────────────────────

def search_similar_chunks(
    query_embedding: np.ndarray,
    document_id: int,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Search a single document's FAISS index for the *top_k* most similar chunks.

    Parameters
    ----------
    query_embedding : np.ndarray
        L2-normalised float32 embedding of shape ``(D,)`` or ``(1, D)``.
    document_id : int
        Database document ID whose index to search.
    top_k : int
        Number of nearest neighbours to retrieve (default 5).

    Returns
    -------
    list[dict]
        Matched chunk dicts, each augmented with a ``"score"`` key
        (inner-product similarity, 0–1 for normalised vectors).
        Empty list if the index does not exist or an error occurs.
    """
    loaded = load_index(document_id)
    if loaded is None:
        return []

    index, chunks = loaded
    return _run_search(query_embedding, index, chunks, top_k)


def search_across_documents(
    query_embedding: np.ndarray,
    document_ids: List[int],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Search across multiple documents' FAISS indices and return the globally
    *top_k* most similar chunks.

    Parameters
    ----------
    query_embedding : np.ndarray
        L2-normalised query embedding.
    document_ids : list[int]
        IDs of documents to search.  If empty, returns empty list.
    top_k : int
        Number of globally best results to return.

    Returns
    -------
    list[dict]
        Top-k results across all specified documents, sorted by score descending.
    """
    if not document_ids:
        return []

    all_results: List[Dict[str, Any]] = []

    for doc_id in document_ids:
        results = search_similar_chunks(
            query_embedding, doc_id, top_k=top_k
        )
        all_results.extend(results)

    # Sort by score descending and take top_k globally
    all_results.sort(key=lambda r: r.get("score", 0.0), reverse=True)
    return all_results[:top_k]


def _run_search(
    query_embedding: np.ndarray,
    index: faiss.Index,
    chunks: List[Dict[str, Any]],
    top_k: int,
) -> List[Dict[str, Any]]:
    """
    Internal search helper: run FAISS kNN search and attach chunk data.

    Parameters
    ----------
    query_embedding : np.ndarray
        Query vector.
    index : faiss.Index
        Populated FAISS index.
    chunks : list[dict]
        Chunk list parallel to the index vectors.
    top_k : int
        Number of results.

    Returns
    -------
    list[dict]
        Matched chunks with scores.
    """
    # Ensure shape (1, D)
    qe = query_embedding.reshape(1, -1).astype(np.float32)

    # Cap top_k to the number of indexed vectors
    k = min(top_k, index.ntotal)
    if k == 0:
        return []

    distances, indices = index.search(qe, k)

    results: List[Dict[str, Any]] = []
    for score, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(chunks):
            continue  # FAISS returns -1 for padded results
        chunk = chunks[idx].copy()
        chunk["score"] = float(score)
        results.append(chunk)

    return results


def delete_document_index(document_id: int) -> None:
    """
    Delete the FAISS index and chunks files for a document if they exist.

    Parameters
    ----------
    document_id : int
        Database document ID.
    """
    index_path = get_document_index_path(document_id)
    chunks_path = _get_chunks_path(document_id)

    for path in (index_path, chunks_path):
        if os.path.isfile(path):
            try:
                os.remove(path)
                logger.info(f"Deleted FAISS resource: {path}")
            except Exception as exc:
                logger.error(f"Failed to delete FAISS resource {path}: {exc}")

