// ========================
// Enums
// ========================

export enum DocumentStatus {
  UPLOADING = "uploading",
  PARSING = "parsing",
  OCR_PROCESSING = "ocr_processing",
  CLASSIFYING = "classifying",
  CREATING_EMBEDDINGS = "creating_embeddings",
  INDEXED = "indexed",
  ERROR = "error",
}

export enum MessageRole {
  USER = "user",
  ASSISTANT = "assistant",
}

// ========================
// Auth
// ========================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  otp?: string;
}


// ========================
// Documents
// ========================

export interface ParsedPage {
  id: string;
  documentId: string;
  pageNumber: number;
  rawText: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  wordCount: number;
}

export interface Classification {
  category: string;
  subcategory?: string;
  confidence: number;
  tags: string[];
  summary: string;
  keyEntities: string[];
  language: string;
}

export interface Document {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  status: DocumentStatus;
  classification?: Classification;
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
  embeddingCount?: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  progress: number;
  message?: string;
}

// ========================
// Upload
// ========================

export interface UploadProgress {
  fileId: string;
  filename: string;
  size: number;
  status: DocumentStatus;
  progress: number;
  documentId?: string;
  error?: string;
}

// ========================
// Chat
// ========================

export interface Citation {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  createdAt: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  documentIds?: string[];
  messageCount: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  sessionId?: string;
  message: string;
  documentIds?: string[];
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  citations: Citation[];
}

// ========================
// Analytics
// ========================

export interface DocumentTypeStats {
  type: string;
  count: number;
  color: string;
}

export interface AnalyticsData {
  totalDocuments: number;
  processedDocuments: number;
  totalEmbeddings: number;
  chatSessions: number;
  processingSuccessRate: number;
  documentsByType: DocumentTypeStats[];
  recentDocuments: Document[];
  recentChatSessions: ChatSession[];
}

// ========================
// Voice
// ========================

export interface VoiceTranscribeResponse {
  transcript: string;
  confidence: number;
}

// ========================
// UI State
// ========================

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}
