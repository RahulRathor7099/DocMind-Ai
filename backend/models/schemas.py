"""
DocMind AI - Pydantic Schemas
Request/Response models for all API endpoints
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    otp: Optional[str] = None


class OTPRequest(BaseModel):
    email: EmailStr



class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Document Schemas ─────────────────────────────────────────────────────────

class DocumentStatus(BaseModel):
    document_id: int
    status: str
    error_message: Optional[str] = None
    progress_pct: int = 0


class ClassificationData(BaseModel):
    document_type: Optional[str] = None
    topic: Optional[str] = None
    sensitivity_level: Optional[str] = None
    language: Optional[str] = None
    domain: Optional[str] = None
    summary: Optional[str] = None
    business_relevance: Optional[str] = None
    confidence_score: Optional[float] = None

    class Config:
        from_attributes = True


class ClassificationResponse(BaseModel):
    id: int
    document_id: int
    document_type: Optional[str] = None
    topic: Optional[str] = None
    sensitivity_level: Optional[str] = None
    language: Optional[str] = None
    domain: Optional[str] = None
    summary: Optional[str] = None
    business_relevance: Optional[str] = None
    confidence_score: Optional[float] = None
    classified_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    total_pages: int
    status: str
    upload_time: datetime
    processed_at: Optional[datetime] = None
    classification: Optional[ClassificationResponse] = None

    class Config:
        from_attributes = True


class ParsedPageResponse(BaseModel):
    id: int
    document_id: int
    page_number: int
    extracted_text: str
    page_image_path: Optional[str] = None
    has_tables: bool
    ocr_applied: bool
    word_count: int

    class Config:
        from_attributes = True


# ─── Chat / RAG Schemas ───────────────────────────────────────────────────────

class Citation(BaseModel):
    document_name: str
    document_id: int
    page_number: int
    chunk_text: str
    page_image_url: Optional[str] = None
    relevance_score: Optional[float] = None


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1)
    document_ids: list[int] = Field(default=[])  # empty = search all user docs


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation] = []
    session_id: str
    tokens_used: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    role: str
    message: str
    citations: Optional[list[Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    session_id: str
    session_name: str
    last_message: Optional[str] = None
    message_count: int
    created_at: datetime


# Analytics models defined below


# ─── Voice Schemas ────────────────────────────────────────────────────────────

class VoiceInputResponse(BaseModel):
    transcript: str
    confidence: Optional[float] = None
    language: Optional[str] = None


# ─── Chat History & Sessions (imported by routers) ───────────────────────────

class ChatHistoryItem(BaseModel):
    id: int
    session_id: str
    role: str
    message: str
    citations: Optional[list[Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionInfo(BaseModel):
    session_id: str
    message_count: int
    last_activity: datetime
    first_message: Optional[str] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


# ─── Document List & Upload Responses ─────────────────────────────────────────

class UploadResponse(BaseModel):
    document_id: int
    filename: str
    status: str
    message: str


class DocumentListResponse(BaseModel):
    total: int
    documents: list[DocumentResponse]


# ─── Analytics & Recent Activity Schemas ──────────────────────────────────────

class DocumentTypeCount(BaseModel):
    document_type: str
    count: int


class RecentActivity(BaseModel):
    date: str
    uploads: int
    queries: int


class AnalyticsResponse(BaseModel):
    total_documents: int
    total_processed: int
    total_failed: int
    total_embeddings: int
    total_chat_sessions: int
    total_chat_messages: int
    processing_success_rate: float
    documents_by_type: list[DocumentTypeCount]
    recent_activity: list[RecentActivity]
    storage_used_bytes: int
    storage_used_human: str
    recent_documents: list[DocumentResponse] = []
    recent_chat_sessions: list[ChatSessionResponse] = []


