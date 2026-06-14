"""
DocMind AI - FastAPI Application Entry Point
Production-ready document intelligence and agentic RAG system
"""

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from utils.config import get_settings
from utils.logger import get_logger
from models.database import create_tables, engine
from api.upload_routes import router as upload_router
from api.document_routes import router as document_router
from api.chat_routes import router as chat_router
from api.analytics_routes import router as analytics_router
from api.voice_routes import router as voice_router
from auth.auth_routes import router as auth_router

settings = get_settings()
logger = get_logger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("🚀 DocMind AI Backend starting up...")

    # Create database tables
    create_tables()
    logger.info("✅ Database tables initialized")

    # Create upload directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "pages"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "faiss"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "temp"), exist_ok=True)
    logger.info("✅ Upload directories ready")

    logger.info(f"🤖 LLM Provider: {settings.LLM_PROVIDER.upper()}")
    logger.info("✅ DocMind AI is ready!")

    yield

    logger.info("👋 DocMind AI shutting down...")


# Create FastAPI app
app = FastAPI(
    title="DocMind AI API",
    description="Document Intelligence + Agentic RAG System — AI Engineer Internship Assessment",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
allowed_origins = settings.ALLOWED_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for page images
uploads_dir = settings.UPLOAD_DIR
if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Register all routers
app.include_router(auth_router, tags=["Authentication"])
app.include_router(upload_router, tags=["Documents"])
app.include_router(document_router, tags=["Documents"])
app.include_router(chat_router, tags=["Chat & RAG"])
app.include_router(analytics_router, tags=["Analytics"])
app.include_router(voice_router, tags=["Voice"])


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "app": "DocMind AI",
        "version": "1.0.0",
        "message": "Document Intelligence + Agentic RAG System",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )
