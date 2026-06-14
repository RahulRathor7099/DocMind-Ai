# DocMind AI — Document Intelligence + Agentic RAG

<div align="center">

![DocMind AI Banner](https://img.shields.io/badge/DocMind-AI-7c3aed?style=for-the-badge&logo=openai&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)
![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Production-ready AI SaaS for intelligent document processing, OCR extraction, LLM classification, and agentic RAG-based Q&A with grounded citations.**

[Live Demo](#) · [API Docs](http://localhost:8000/docs) · [Report Bug](#) · [Request Feature](#)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Security Decisions](#security-decisions)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## 🎯 Overview

DocMind AI is a production-grade AI web application that transforms any document — PDFs, scanned files, handwritten notes, image-heavy reports — into queryable intelligence. Users can upload documents, receive automatic AI-powered classification, and chat with their documents using an agentic RAG system that provides answers with **exact page citations and visual page thumbnails**.

### What Makes It Special

- **Universal Document Support**: PDFs, scanned images, handwritten notes, DOCX, TXT
- **Smart OCR Pipeline**: Automatically detects scanned pages and applies pytesseract OCR
- **LLM Classification**: Auto-classifies document type, sensitivity, domain, language using Gemini/Groq
- **Agentic RAG**: Multi-step reasoning with FAISS vector search and citation extraction
- **Production Security**: Rate limiting, JWT auth, MIME validation, file sanitization
- **Premium UI**: Dark glassmorphism SaaS design with Framer Motion animations

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 15 + TypeScript)               │
│                                                                       │
│  Landing → Auth → Dashboard → Upload → Documents → Chat → Analytics  │
│                                                                       │
│  Components: DropZone, FileCard, ChatInterface, CitationCard,         │
│              PagePreviewModal, VoiceButton, StatCard, DocumentCard    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API (Axios + JWT)
                               │ Port 8000
┌──────────────────────────────▼──────────────────────────────────────┐
│                      BACKEND (FastAPI + Python)                       │
│                                                                       │
│  Auth Layer → Upload API → Document Parser → Classifier → RAG Chat   │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │   Parsers   │  │  Classifier  │  │      RAG Pipeline          │  │
│  │             │  │              │  │                            │  │
│  │ pdfplumber  │  │  Gemini API  │  │  Chunker → Embeddings      │  │
│  │ pdf2image   │  │  Groq API    │  │  FAISS Index               │  │
│  │ pytesseract │  │  (fallback)  │  │  LangChain Agent           │  │
│  │ python-docx │  │              │  │  Citation Extractor        │  │
│  └─────────────┘  └──────────────┘  └────────────────────────────┘  │
└──────┬───────────────────────┬────────────────────────┬─────────────┘
       │                       │                        │
  ┌────▼────┐           ┌──────▼──────┐        ┌───────▼──────┐
  │ SQLite  │           │    FAISS    │         │  File System │
  │   DB    │           │   Vector   │         │   Uploads    │
  │ 6 tables│           │   Store    │         │  Page Images │
  └─────────┘           └────────────┘         └─────────────┘
```

### Document Processing Pipeline

```
Upload File
    │
    ▼
Security Validation (MIME + size + extension)
    │
    ▼
File Router (PDF / DOCX / Image / TXT)
    │
    ▼
Text Extraction (pdfplumber)
    │
    ▼
Page Images (pdf2image → PNG per page)
    │
    ▼
OCR Check → If scanned → pytesseract
    │
    ▼
Table Detection (pdfplumber tables)
    │
    ▼
LLM Classification (Gemini Flash 1.5)
    │
    ▼
Text Chunking (RecursiveCharacterTextSplitter)
    │
    ▼
Embedding Generation (sentence-transformers)
    │
    ▼
FAISS Index Storage
    │
    ▼
Status: INDEXED ✓
```

### RAG Query Pipeline

```
User Question
    │
    ▼
Question Embedding (sentence-transformers)
    │
    ▼
FAISS Similarity Search (top-5 chunks)
    │
    ▼
Context Assembly + Chat History
    │
    ▼
LLM Generation (Gemini/Groq)
    │
    ▼
Citation Extraction (page numbers + document names)
    │
    ▼
Response + Citations + Page Thumbnails
```

---

## ✨ Features

### Module 1 — Authentication
- [x] JWT-based authentication (HS256)
- [x] bcrypt password hashing
- [x] Protected routes middleware
- [x] Session management with localStorage
- [x] Auto-redirect on token expiry

### Module 2 — Bulk Document Upload
- [x] Drag-and-drop multi-file upload
- [x] Real-time processing status updates (polling)
- [x] Status stages: Uploading → Parsing → OCR → Classifying → Embedding → Indexed
- [x] File preview cards with animated progress bars
- [x] Queue management + individual delete
- [x] Supported: PDF, PNG, JPG, JPEG, TXT, DOCX (max 50MB)

### Module 3 — Document Parser Engine
- [x] PDF text extraction (pdfplumber)
- [x] PDF page-to-image conversion (pdf2image)
- [x] Automatic OCR detection and extraction (pytesseract)
- [x] Table detection and structured extraction
- [x] DOCX paragraph/table extraction
- [x] Image file OCR (PNG/JPG)
- [x] Page-wise structured storage

### Module 4 — LLM Document Classification
- [x] Automatic classification: type, topic, sensitivity, language, domain
- [x] Business relevance scoring
- [x] Confidence score
- [x] Visual tags in UI
- [x] Summary generation

### Module 5 — Agentic RAG Chat
- [x] Multi-document vector search (FAISS)
- [x] Sentence Transformer embeddings (local, no API cost)
- [x] LangChain-powered reasoning
- [x] Multi-turn conversation memory
- [x] Grounded citations with exact page numbers
- [x] Page thumbnail previews in citations
- [x] Full-page modal on click
- [x] Hallucination prevention ("No relevant information found")
- [x] Voice input (Web Speech API)

### Analytics Dashboard
- [x] Animated stat counters
- [x] Processing success rate
- [x] Documents by type breakdown
- [x] Recent activity feed

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 15 (App Router) |
| Frontend Language | TypeScript |
| Styling | Tailwind CSS + Custom CSS |
| UI Components | Shadcn UI + Radix UI |
| Animations | Framer Motion |
| State Management | Zustand |
| API Client | Axios + React Query |
| Backend Framework | FastAPI |
| Backend Language | Python 3.11+ |
| Database | SQLite (upgradeable to PostgreSQL) |
| ORM | SQLAlchemy |
| AI/LLM | Google Gemini Flash 1.5 / Groq Llama |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Vector Database | FAISS |
| LLM Framework | LangChain |
| PDF Processing | pdfplumber + pdf2image |
| OCR | pytesseract + Pillow |
| DOCX | python-docx |
| Auth | JWT (python-jose) + bcrypt |
| Rate Limiting | slowapi |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

---

## ⚡ Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Tesseract OCR binary
- Poppler (for pdf2image)
- A Gemini API key (free at [Google AI Studio](https://aistudio.google.com))

### 1. Install Tesseract OCR

**Windows:**
```bash
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
# Install to: C:\Program Files\Tesseract-OCR
# Add to PATH
```

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

### 2. Install Poppler (for pdf2image)

**Windows:**
```bash
# Download from: https://github.com/oschwartz10612/poppler-windows/releases
# Extract to C:\poppler
# Add C:\poppler\Library\bin to PATH
```

**macOS:**
```bash
brew install poppler
```

**Ubuntu/Debian:**
```bash
sudo apt-get install poppler-utils
```

---

## 🌱 Sample Documents & First-Run Seeding

To ensure the chatbot works immediately on the first run, the project includes an auto-seeding system:

1. **Pre-Bundled Samples**: 6 diverse sample documents (PDF, DOCX, TXT, OCR-ready PNGs) are generated in the `sample_documents/` folder.
2. **Auto-Seeding**: When the backend starts up, if it detects a clean database (0 users), it automatically creates a demo user and triggers background indexing for all 6 sample documents.
3. **Demo Account**:
   - **Email**: `demo@docmind.ai`
   - **Password**: `DemoUser123!`

You can log in immediately with this account to test the chatbot and dashboard features out-of-the-box!

If you ever want to re-seed or manually seed these documents, you can run:
```bash
cd backend
# Activate virtual environment
venv\Scripts\activate
# Run seeder
python seed_samples.py
```

---

## 📦 Installation

### Backend Setup

```bash
# Clone and navigate
cd "DocMind AI/backend"

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your API key
# At minimum: GEMINI_API_KEY=your_key_here

# Start the backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: http://localhost:8000
API Docs at: http://localhost:8000/docs

### Frontend Setup

```bash
# Navigate to frontend
cd "DocMind AI/frontend"

# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Start the frontend
npm run dev
```

Frontend runs at: http://localhost:3000

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
# Authentication
SECRET_KEY=your-super-secret-jwt-key-minimum-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Database
DATABASE_URL=sqlite:///./docmind.db

# LLM Provider (choose one: gemini, groq, openai)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
OPENAI_API_KEY=your-openai-api-key

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=DocMind AI
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, get JWT token |
| GET | `/auth/me` | Get current user profile |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload document file |
| GET | `/documents` | List all user documents |
| GET | `/document/{id}` | Get document with classification |
| GET | `/document/{id}/status` | Poll processing status |
| GET | `/document/{id}/pages` | Get all parsed pages |
| GET | `/document/{id}/page/{n}/image` | Get page thumbnail |
| DELETE | `/document/{id}` | Delete document + data |

### Chat (RAG)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ask` | Ask question, get answer + citations |
| GET | `/chat-sessions` | List all chat sessions |
| GET | `/chat-history/{session_id}` | Get session history |
| DELETE | `/chat-history/{session_id}` | Clear chat session |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics` | Dashboard statistics |

### Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/voice-input` | Transcribe audio to text |

---

## 🔒 Security Decisions

### Implemented ✅

| Security Measure | Implementation |
|-----------------|----------------|
| **Password Hashing** | bcrypt with salt rounds via passlib |
| **JWT Authentication** | HS256 tokens with 24h expiry |
| **File Type Validation** | Extension whitelist + MIME type checking |
| **File Size Limit** | Configurable max (default 50MB) |
| **Filename Sanitization** | Strip dangerous chars, generate UUID names |
| **Rate Limiting** | slowapi: 10/min upload, 30/min chat, 100/min general |
| **CORS Configuration** | Explicit allowed origins in env var |
| **Environment Variables** | All secrets in .env, never in code |
| **Temp File Cleanup** | Processing files deleted after embedding |
| **Auth Middleware** | All routes except /auth/* require valid JWT |
| **SQL Injection Prevention** | SQLAlchemy ORM (parameterized queries) |
| **Basic PDF Malice Check** | Detect JS actions and /Launch objects in PDFs |

### Not Implemented (Future Work) ⚠️

| Feature | Reason / Future Plan |
|---------|---------------------|
| **Antivirus Scanning** | Requires ClamAV integration — recommended for production |
| **File Encryption at Rest** | Adds complexity; use encrypted filesystem in production |
| **HTTPS/TLS** | Handled at deployment level (Vercel/Render auto-TLS) |
| **2FA Authentication** | Future enhancement |
| **Audit Logging** | Database audit trail — planned for v2 |
| **Content Security Policy** | Next.js headers config — add for production hardening |
| **DDoS Protection** | Use Cloudflare in production |

---

## 🚀 Deployment

### Frontend → Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Backend → Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Configure:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3.11
4. Add environment variables in Render dashboard
5. Add `render.yaml` for auto-deployment:

```yaml
services:
  - type: web
    name: docmind-backend
    env: python
    buildCommand: "apt-get install -y tesseract-ocr poppler-utils && pip install -r requirements.txt"
    startCommand: "uvicorn main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: SECRET_KEY
        generateValue: true
```

---

## 📁 Project Structure

```
DocMind AI/
├── README.md
├── .env.example
│
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment template
│   │
│   ├── auth/
│   │   ├── auth_handler.py        # JWT + bcrypt
│   │   └── auth_routes.py         # /auth/* endpoints
│   │
│   ├── models/
│   │   ├── database.py            # SQLAlchemy setup + all models
│   │   └── schemas.py             # Pydantic schemas
│   │
│   ├── api/
│   │   ├── upload_routes.py       # Document upload API
│   │   ├── document_routes.py     # Document management API
│   │   ├── chat_routes.py         # RAG chat API
│   │   ├── analytics_routes.py    # Dashboard analytics
│   │   └── voice_routes.py        # Voice input API
│   │
│   ├── parsers/
│   │   ├── pdf_parser.py          # pdfplumber + pdf2image
│   │   ├── ocr_engine.py          # pytesseract OCR
│   │   ├── table_extractor.py     # Table detection
│   │   ├── docx_parser.py         # python-docx
│   │   ├── image_parser.py        # Image OCR
│   │   └── file_router.py         # File type routing
│   │
│   ├── services/
│   │   ├── document_service.py    # Main orchestrator
│   │   ├── classification_service.py # LLM classification
│   │   ├── storage_service.py     # File storage
│   │   └── security_service.py    # Security validation
│   │
│   ├── rag/
│   │   ├── chunker.py             # Text chunking
│   │   ├── embeddings.py          # Sentence Transformers
│   │   ├── vector_store.py        # FAISS operations
│   │   ├── chat_memory.py         # Conversation memory
│   │   └── rag_agent.py           # LangChain RAG pipeline
│   │
│   ├── utils/
│   │   ├── config.py              # Settings
│   │   ├── logger.py              # Logging
│   │   └── file_utils.py          # File helpers
│   │
│   └── uploads/                   # Runtime: uploaded files
│       ├── pages/                 # Page images
│       └── faiss/                 # Vector indices
│
└── frontend/
    ├── app/
    │   ├── layout.tsx             # Root layout
    │   ├── page.tsx               # Landing page
    │   ├── (auth)/
    │   │   ├── login/page.tsx     # Login page
    │   │   └── signup/page.tsx    # Signup page
    │   └── (dashboard)/
    │       ├── layout.tsx         # Dashboard layout
    │       ├── dashboard/page.tsx # Analytics
    │       ├── upload/page.tsx    # Document upload
    │       ├── documents/
    │       │   ├── page.tsx       # Document library
    │       │   └── [id]/page.tsx  # Document detail
    │       └── chat/
    │           ├── page.tsx       # Chat sessions
    │           └── [sessionId]/page.tsx # Chat interface
    │
    ├── components/
    │   ├── layout/                # Navbar, Sidebar
    │   ├── upload/                # DropZone, FileCard
    │   ├── chat/                  # MessageBubble, CitationCard, Modal, Voice
    │   ├── dashboard/             # StatCard, Charts
    │   └── common/                # Backgrounds, Spinner
    │
    ├── hooks/                     # useAuth, useUpload, useChat, useVoice
    ├── lib/                       # api.ts, types.ts, utils.ts
    └── public/                    # Static assets
```

---

## 🎓 Assessment Notes

This project demonstrates:

1. **Document Intelligence**: Multi-format parsing pipeline with automatic OCR detection
2. **LLM Integration**: Structured prompting for classification with JSON output parsing
3. **Vector Search**: FAISS with sentence-transformer embeddings for semantic retrieval
4. **Agentic RAG**: Multi-step reasoning with grounded citation extraction
5. **Production Engineering**: Auth, rate limiting, security validation, error handling
6. **Modern Frontend**: Type-safe Next.js 15 with premium SaaS design patterns

---

<div align="center">

Built with ❤️ for the AI Engineer Internship Assessment

**DocMind AI** — *Turning Documents into Intelligence*

</div>
