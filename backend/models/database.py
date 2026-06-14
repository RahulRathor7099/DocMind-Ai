"""
DocMind AI - Database Models and Setup
SQLAlchemy ORM models for all 6 database tables
"""

import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String,
    DateTime, Float, Text, ForeignKey, Boolean, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

from utils.config import get_settings

settings = get_settings()

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    """User accounts table."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    """Uploaded documents table."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, png, jpg, txt, docx
    file_size = Column(Integer, nullable=False)      # bytes
    total_pages = Column(Integer, default=0)
    status = Column(String(50), default="uploading")
    # Status values: uploading | parsing | ocr_processing | classifying | creating_embeddings | indexed | failed
    error_message = Column(Text, nullable=True)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    owner = relationship("User", back_populates="documents")
    parsed_pages = relationship("ParsedPage", back_populates="document", cascade="all, delete-orphan")
    classification = relationship("DocumentClassification", back_populates="document", uselist=False, cascade="all, delete-orphan")
    embeddings_metadata = relationship("EmbeddingsMetadata", back_populates="document", cascade="all, delete-orphan")


class ParsedPage(Base):
    """Parsed pages from documents."""
    __tablename__ = "parsed_pages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    extracted_text = Column(Text, default="")
    page_image_path = Column(String(512), nullable=True)
    has_tables = Column(Boolean, default=False)
    tables_data = Column(JSON, nullable=True)   # JSON list of tables
    ocr_applied = Column(Boolean, default=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="parsed_pages")


class DocumentClassification(Base):
    """LLM classification results for documents."""
    __tablename__ = "document_classifications"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), unique=True, nullable=False)
    document_type = Column(String(100), nullable=True)    # Invoice, Report, Contract, etc.
    topic = Column(String(100), nullable=True)
    sensitivity_level = Column(String(50), nullable=True) # Public, Internal, Confidential, Restricted
    language = Column(String(50), nullable=True)
    domain = Column(String(100), nullable=True)           # Business, Legal, Medical, etc.
    summary = Column(Text, nullable=True)
    business_relevance = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    raw_classification = Column(JSON, nullable=True)
    classified_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="classification")


class EmbeddingsMetadata(Base):
    """Metadata about stored embeddings for each document."""
    __tablename__ = "embeddings_metadata"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    total_chunks = Column(Integer, default=0)
    embedding_model = Column(String(100), nullable=True)
    index_path = Column(String(512), nullable=True)      # FAISS index file path
    chunks_path = Column(String(512), nullable=True)     # JSON chunks metadata path
    embedding_dim = Column(Integer, default=384)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="embeddings_metadata")


class ChatHistory(Base):
    """Chat conversations and messages."""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(100), nullable=False, index=True)
    session_name = Column(String(255), default="New Chat")
    role = Column(String(20), nullable=False)  # user | assistant
    message = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)    # List of citation objects
    document_ids = Column(JSON, nullable=True) # Which documents were queried
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="chat_histories")


# ─── Database Utilities ───────────────────────────────────────────────────────

def create_tables():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency injection for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
