"""
rag/rag_agent.py
----------------
Core Retrieval-Augmented Generation pipeline for DocMind AI.

Pipeline steps
--------------
1. Embed the user question with SentenceTransformers.
2. Search FAISS indices of the selected documents (or all user documents)
   for the top-k most similar chunks.
3. Build a context string from the retrieved chunks.
4. Construct a prompt that includes chat history, context, and the question.
5. Call the LLM (Gemini 1.5 Flash primary, Groq fallback).
6. Assemble citations from the retrieved chunks.
7. Return the answer and citations.

Return schema
-------------
::

    {
        "answer":    str,
        "citations": [
            {
                "document_name":   str,
                "document_id":     int,
                "page_number":     int,
                "chunk_text":      str,
                "page_image_path": str | None,
                "relevance_score": float,
            },
            ...
        ],
        "model_used": str,
    }
"""

import os
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from sqlalchemy.orm import Session

from models.database import Document, ParsedPage
from rag.chat_memory import ConversationMemory
from rag.embeddings import embed_single
from rag.vector_store import search_across_documents, search_similar_chunks
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ── Gemini initialisation ──────────────────────────────────────────────────
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# Constants
TOP_K = 5
NO_CONTEXT_ANSWER = (
    "I could not find relevant information in the uploaded documents "
    "to answer your question. Please ensure the relevant document has "
    "been uploaded and successfully processed."
)

# ── Prompt template ────────────────────────────────────────────────────────
RAG_PROMPT_TEMPLATE = """You are DocMind AI, an intelligent document analysis assistant.
Answer the user's question using ONLY the provided document context below.
If the context does not contain enough information to answer the question, say so clearly.
Do NOT hallucinate or use knowledge outside the provided context.
Cite the source document and page number when providing information.

--- CONVERSATION HISTORY ---
{chat_history}

--- DOCUMENT CONTEXT ---
{context}

--- USER QUESTION ---
{question}

--- YOUR ANSWER ---
"""


# ── LLM callers ────────────────────────────────────────────────────────────

async def _call_gemini(prompt: str) -> Optional[str]:
    """
    Call Gemini 1.5 Flash and return the response text.

    Parameters
    ----------
    prompt : str
        Fully assembled RAG prompt.

    Returns
    -------
    str or None
        Generated answer text, or None if the call fails.
    """
    if not settings.GEMINI_API_KEY:
        return None

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=2048,
            ),
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as exc:
        logger.error(f"Gemini RAG call failed: {exc}")
        return None


async def _call_groq(prompt: str) -> Optional[str]:
    """
    Call Groq (llama3-8b-8192) and return the response text.

    Parameters
    ----------
    prompt : str
        Fully assembled RAG prompt.

    Returns
    -------
    str or None
        Generated answer text, or None if the call fails.
    """
    if not settings.GROQ_API_KEY:
        return None

    try:
        from groq import Groq

        client = Groq(api_key=settings.GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2048,
        )
        return (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.error(f"Groq RAG call failed: {exc}")
        return None


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_all_user_document_ids(user_id: int, db: Session) -> List[int]:
    """
    Return the IDs of all *indexed* documents owned by *user_id*.

    Parameters
    ----------
    user_id : int
        ID of the authenticated user.
    db : Session
        Active database session.

    Returns
    -------
    list[int]
        List of document IDs.
    """
    docs = (
        db.query(Document.id)
        .filter(Document.user_id == user_id, Document.status == "indexed")
        .all()
    )
    return [d.id for d in docs]


def _get_page_image_path(document_id: int, page_number: int, db: Session) -> Optional[str]:
    """
    Look up the page image path for a specific document page.

    Parameters
    ----------
    document_id : int
        Database document ID.
    page_number : int
        1-indexed page number.
    db : Session
        Active database session.

    Returns
    -------
    str or None
        Absolute path to the page image, or None if not available.
    """
    page = (
        db.query(ParsedPage)
        .filter(
            ParsedPage.document_id == document_id,
            ParsedPage.page_number == page_number,
        )
        .first()
    )
    if page and page.page_image_path and os.path.isfile(page.page_image_path):
        return page.page_image_path
    return None


def _build_context(chunks: List[Dict[str, Any]]) -> str:
    """
    Assemble retrieved chunks into a formatted context string.

    Parameters
    ----------
    chunks : list[dict]
        Top-k retrieved chunk dicts (each with ``text`` and ``metadata`` keys).

    Returns
    -------
    str
        Formatted context block ready for prompt injection.
    """
    if not chunks:
        return "No relevant document content found."

    parts: List[str] = []
    for i, chunk in enumerate(chunks, start=1):
        meta = chunk.get("metadata", {})
        doc_name = meta.get("document_name", "Unknown Document")
        page_num = meta.get("page_number", "?")
        text = chunk.get("text", "")
        score = chunk.get("score", 0.0)

        parts.append(
            f"[Source {i}] Document: {doc_name} | Page: {page_num} | "
            f"Relevance: {score:.2f}\n{text}"
        )

    return "\n\n---\n\n".join(parts)


# ── Main pipeline ──────────────────────────────────────────────────────────

async def answer_question(
    question: str,
    user_id: int,
    session_id: str,
    document_ids: List[int],
    db: Session,
    memory: ConversationMemory,
) -> Dict[str, Any]:
    """
    Execute the full RAG pipeline for a user question.

    Parameters
    ----------
    question : str
        The user's question.
    user_id : int
        ID of the authenticated user.
    session_id : str
        Chat session identifier for conversation memory.
    document_ids : list[int]
        Documents to restrict search to.  If empty, all user documents
        with status ``"indexed"`` are searched.
    db : Session
        Active database session.
    memory : ConversationMemory
        In-process conversation memory for this session.

    Returns
    -------
    dict
        ``{"answer": str, "citations": list, "model_used": str}``
    """
    logger.info(
        f"RAG pipeline: user={user_id}, session={session_id}, "
        f"doc_ids={document_ids or 'all'}, question='{question[:80]}…'"
    )

    # ── Step 1: Resolve document IDs ───────────────────────────────────────
    if not document_ids:
        document_ids = _get_all_user_document_ids(user_id, db)
        logger.debug(f"Searching across {len(document_ids)} indexed document(s)")

    if not document_ids:
        logger.warning(f"User {user_id} has no indexed documents")
        memory.add_exchange(question, NO_CONTEXT_ANSWER)
        return {
            "answer": NO_CONTEXT_ANSWER,
            "citations": [],
            "model_used": None,
        }

    # ── Step 2: Embed question ─────────────────────────────────────────────
    try:
        query_embedding = embed_single(question)
    except Exception as exc:
        logger.error(f"Question embedding failed: {exc}")
        return {
            "answer": "An error occurred while processing your question. Please try again.",
            "citations": [],
            "model_used": None,
        }

    # ── Step 3: Search FAISS ───────────────────────────────────────────────
    if len(document_ids) == 1:
        retrieved_chunks = search_similar_chunks(
            query_embedding, document_ids[0], top_k=TOP_K
        )
    else:
        retrieved_chunks = search_across_documents(
            query_embedding, document_ids, top_k=TOP_K
        )

    logger.debug(f"Retrieved {len(retrieved_chunks)} chunk(s) from FAISS")

    # ── Step 4: Check if any relevant content was found ────────────────────
    # Filter out very low-scoring chunks (score < 0.1 for cosine similarity)
    relevant_chunks = [c for c in retrieved_chunks if c.get("score", 0.0) >= 0.05]

    if not relevant_chunks:
        logger.info("No relevant chunks found above threshold")
        memory.add_exchange(question, NO_CONTEXT_ANSWER)
        return {
            "answer": NO_CONTEXT_ANSWER,
            "citations": [],
            "model_used": None,
        }

    # ── Step 5: Build prompt ───────────────────────────────────────────────
    context = _build_context(relevant_chunks)
    chat_history = memory.get_context_string()

    prompt = RAG_PROMPT_TEMPLATE.format(
        chat_history=chat_history if chat_history else "No previous conversation.",
        context=context,
        question=question,
    )

    # ── Step 6: Call LLM ───────────────────────────────────────────────────
    model_used: str = "unknown"
    answer: Optional[str] = None

    provider = settings.effective_llm_provider

    if provider == "gemini":
        answer = await _call_gemini(prompt)
        model_used = "gemini-1.5-flash"
        if not answer:
            logger.info("Gemini failed; falling back to Groq")
            answer = await _call_groq(prompt)
            model_used = "llama-3.1-8b-instant (Groq)"
    elif provider == "groq":
        answer = await _call_groq(prompt)
        model_used = "llama-3.1-8b-instant (Groq)"
        if not answer:
            logger.info("Groq failed; falling back to Gemini")
            answer = await _call_gemini(prompt)
            model_used = "gemini-1.5-flash"
    else:
        answer = await _call_gemini(prompt) or await _call_groq(prompt)
        model_used = "gemini-1.5-flash / groq fallback"

    if not answer:
        answer = (
            "I was unable to generate a response at this time. "
            "Please check that your API keys are configured and try again."
        )
        model_used = "none"

    # ── Step 7: Assemble citations ─────────────────────────────────────────
    citations: List[Dict[str, Any]] = []
    seen_chunks: set = set()

    for chunk in relevant_chunks:
        meta = chunk.get("metadata", {})
        chunk_text = chunk.get("text", "")

        # Deduplicate by chunk text fingerprint
        fingerprint = chunk_text[:100]
        if fingerprint in seen_chunks:
            continue
        seen_chunks.add(fingerprint)

        doc_id = meta.get("document_id", 0)
        page_num = meta.get("page_number", 0)

        citation: Dict[str, Any] = {
            "document_name": meta.get("document_name", "Unknown"),
            "document_id": doc_id,
            "page_number": page_num,
            "chunk_text": chunk_text,
            "page_image_path": _get_page_image_path(doc_id, page_num, db),
            "relevance_score": round(chunk.get("score", 0.0), 4),
        }
        citations.append(citation)

    # ── Step 8: Update memory ──────────────────────────────────────────────
    memory.add_exchange(question, answer, citations=citations)

    logger.info(
        f"RAG pipeline complete: model={model_used}, "
        f"citations={len(citations)}, answer_len={len(answer)}"
    )

    return {
        "answer": answer,
        "citations": citations,
        "model_used": model_used,
    }
