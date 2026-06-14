"""
api/chat_routes.py
------------------
RAG-powered conversational Q&A endpoints.

Endpoints
---------
POST /ask                           – Ask a question; get AI answer + citations
GET  /chat-history/{session_id}     – Retrieve conversation history
DELETE /chat-history/{session_id}   – Clear conversation history
GET  /chat-sessions                 – List all user chat sessions
"""

import json
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.auth_handler import get_current_user
from models.database import ChatHistory, User, get_db
from models.schemas import (
    ChatHistoryItem,
    ChatRequest,
    ChatResponse,
    ChatSessionInfo,
    Citation,
    MessageResponse,
)
from rag.chat_memory import memory_registry
from rag.rag_agent import answer_question
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Chat / RAG"])


# ── POST /ask ──────────────────────────────────────────────────────────────

@router.post(
    "/ask",
    response_model=ChatResponse,
    summary="Ask a question against uploaded documents",
)
async def ask_question(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Submit a question to the RAG pipeline.

    The pipeline:
    1. Retrieves in-process conversation memory for the session.
    2. Searches FAISS indices of the specified (or all) user documents.
    3. Calls the LLM with retrieved context and conversation history.
    4. Persists both turns (user + assistant) to the database.
    5. Returns the answer with citations.

    Parameters
    ----------
    request : ChatRequest
        ``{question, session_id, document_ids}``

    Returns
    -------
    ChatResponse
        ``{answer, citations, session_id, question, model_used}``

    Raises
    ------
    HTTPException(400)
        If the question is blank.
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    session_id = request.session_id.strip()
    if not session_id:
        session_id = str(uuid.uuid4())

    logger.info(
        f"Chat request: user={current_user.id}, session={session_id}, "
        f"docs={request.document_ids or 'all'}"
    )

    # Get or create in-process memory
    memory = memory_registry.get_or_create(session_id=session_id)

    # Run RAG pipeline
    try:
        result = await answer_question(
            question=question,
            user_id=current_user.id,
            session_id=session_id,
            document_ids=request.document_ids,
            db=db,
            memory=memory,
        )
    except Exception as exc:
        logger.error(f"RAG pipeline error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the answer. Please try again.",
        )

    answer: str = result["answer"]
    citations_raw: List[dict] = result.get("citations", [])
    model_used: str = result.get("model_used", "unknown")

    # Persist user turn
    user_turn = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="user",
        message=question,
        document_ids=json.dumps(request.document_ids) if request.document_ids else None,
    )
    db.add(user_turn)

    # Persist assistant turn
    assistant_turn = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="assistant",
        message=answer,
        citations=json.dumps(citations_raw, default=str) if citations_raw else None,
        document_ids=json.dumps(request.document_ids) if request.document_ids else None,
    )
    db.add(assistant_turn)
    db.commit()

    # Build response citations
    citations: List[Citation] = [
        Citation(
            document_name=c.get("document_name", ""),
            document_id=c.get("document_id", 0),
            page_number=c.get("page_number", 0),
            chunk_text=c.get("chunk_text", ""),
            page_image_path=c.get("page_image_path"),
            relevance_score=c.get("relevance_score"),
        )
        for c in citations_raw
    ]

    return ChatResponse(
        answer=answer,
        citations=citations,
        session_id=session_id,
        tokens_used=None,
    )


# ── GET /chat-history/{session_id} ────────────────────────────────────────

@router.get(
    "/chat-history/{session_id}",
    response_model=List[ChatHistoryItem],
    summary="Retrieve conversation history for a session",
)
def get_chat_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatHistoryItem]:
    """
    Return all conversation turns for *session_id*, ordered chronologically.

    Only turns belonging to the authenticated user are returned.

    Raises
    ------
    HTTPException(404)
        If no history exists for the session.
    """
    history = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.session_id == session_id,
        )
        .order_by(ChatHistory.created_at.asc())
        .all()
    )

    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chat history found for session '{session_id}'.",
        )

    return [ChatHistoryItem.model_validate(h) for h in history]


# ── DELETE /chat-history/{session_id} ─────────────────────────────────────

@router.delete(
    "/chat-history/{session_id}",
    response_model=MessageResponse,
    summary="Clear conversation history for a session",
)
def clear_chat_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Delete all database turns for *session_id* and clear the in-process memory.

    Raises
    ------
    HTTPException(404)
        If no history exists for the session.
    """
    deleted = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.session_id == session_id,
        )
        .delete()
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chat history found for session '{session_id}'.",
        )

    db.commit()

    # Clear in-process memory
    memory_registry.delete(session_id)

    logger.info(
        f"Chat history cleared: session={session_id}, user={current_user.id}, "
        f"turns_deleted={deleted}"
    )

    return MessageResponse(
        message=f"Chat history for session '{session_id}' cleared successfully.",
        detail=f"{deleted} message(s) removed.",
    )


# ── GET /chat-sessions ─────────────────────────────────────────────────────

@router.get(
    "/chat-sessions",
    response_model=List[ChatSessionInfo],
    summary="List all chat sessions for the current user",
)
def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatSessionInfo]:
    """
    Return a summary of each unique chat session belonging to the user.

    Includes session ID, message count, last activity timestamp, and a
    preview of the first user message.
    """
    from sqlalchemy import func

    # Get distinct sessions with stats
    session_stats = (
        db.query(
            ChatHistory.session_id,
            func.count(ChatHistory.id).label("message_count"),
            func.max(ChatHistory.created_at).label("last_activity"),
        )
        .filter(ChatHistory.user_id == current_user.id)
        .group_by(ChatHistory.session_id)
        .order_by(func.max(ChatHistory.created_at).desc())
        .all()
    )

    result: List[ChatSessionInfo] = []
    for row in session_stats:
        # Get the first user message in this session
        first_msg = (
            db.query(ChatHistory.message)
            .filter(
                ChatHistory.user_id == current_user.id,
                ChatHistory.session_id == row.session_id,
                ChatHistory.role == "user",
            )
            .order_by(ChatHistory.created_at.asc())
            .first()
        )

        result.append(
            ChatSessionInfo(
                session_id=row.session_id,
                message_count=row.message_count,
                last_activity=row.last_activity,
                first_message=(first_msg.message[:100] if first_msg else None),
            )
        )

    return result
