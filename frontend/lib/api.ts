import axios, { AxiosInstance } from "axios";
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  Document,
  DocumentListResponse,
  DocumentStatusResponse,
  ParsedPage,
  ChatRequest,
  ChatResponse,
  ChatSession,
  ChatMessage,
  AnalyticsData,
  VoiceTranscribeResponse,
  MessageRole,
  DocumentStatus,
} from "./types";
import { generateId } from "./utils";

const BASE_URL = "/api";

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor — attach JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("docmind_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 unauthorized
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("docmind_token");
        localStorage.removeItem("docmind_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ========================
// Mapping Helpers
// ========================
const mapDocument = (doc: any): Document => {
  if (!doc) return {} as Document;
  return {
    id: (doc.id !== undefined && doc.id !== null) ? doc.id.toString() : (doc.document_id !== undefined && doc.document_id !== null) ? doc.document_id.toString() : "",
    userId: (doc.user_id !== undefined && doc.user_id !== null) ? doc.user_id.toString() : "",
    filename: doc.filename || "",
    originalFilename: doc.original_filename || "",
    mimeType: doc.file_type || "",
    fileSize: doc.file_size || 0,
    pageCount: doc.total_pages || 0,
    status: doc.status as DocumentStatus,
    uploadedAt: doc.upload_time || "",
    processedAt: doc.processed_at,
    errorMessage: doc.error_message,
    classification: doc.classification ? {
      category: doc.classification.document_type || "Unclassified",
      subcategory: doc.classification.topic || "",
      confidence: doc.classification.confidence_score || 0,
      tags: doc.classification.raw_classification?.tags || (doc.classification.topic ? [doc.classification.topic] : []),
      summary: doc.classification.summary || "",
      keyEntities: doc.classification.raw_classification?.key_entities || doc.classification.raw_classification?.entities || [],
      language: doc.classification.language || "en",
    } : undefined,
  };
};

const colors = ["#8B5CF6", "#10B981", "#3B82F6", "#EC4899", "#F59E0B", "#EF4444", "#6366F1"];
const mapAnalytics = (data: any): AnalyticsData => {
  if (!data) return {} as AnalyticsData;
  return {
    totalDocuments: data.total_documents || 0,
    processedDocuments: data.total_processed || 0,
    totalEmbeddings: data.total_embeddings || 0,
    chatSessions: data.total_chat_sessions || 0,
    processingSuccessRate: data.processing_success_rate || 0,
    documentsByType: (data.documents_by_type || []).map((t: any, idx: number) => ({
      type: t.document_type || "Unknown",
      count: t.count || 0,
      color: colors[idx % colors.length],
    })),
    recentDocuments: (data.recent_documents || []).map(mapDocument),
    recentChatSessions: (data.recent_chat_sessions || []).map((s: any) => ({
      id: s.session_id,
      userId: "",
      title: s.session_name || "New Chat",
      messageCount: s.message_count || 0,
      lastMessage: s.last_message || "",
      createdAt: s.created_at || "",
      updatedAt: s.created_at || "",
    })),
  };
};

const mapUser = (user: any): User => {
  if (!user) return {} as User;
  return {
    id: (user.id !== undefined && user.id !== null) ? user.id.toString() : "",
    name: user.name || "",
    email: user.email || "",
    avatar: user.avatar || undefined,
    createdAt: user.created_at || "",
  };
};

// ========================
// Auth API
// ========================
const auth = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<any>("/auth/login", data);
    return {
      access_token: response.data.access_token,
      token_type: response.data.token_type,
      user: mapUser(response.data.user),
    };
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosInstance.post<any>("/auth/register", data);
    return {
      access_token: response.data.access_token,
      token_type: response.data.token_type,
      user: mapUser(response.data.user),
    };
  },

  sendOtp: async (email: string): Promise<any> => {
    const response = await axiosInstance.post<any>("/auth/send-otp", { email });
    return response.data;
  },


  me: async (): Promise<User> => {
    const response = await axiosInstance.get<any>("/auth/me");
    return mapUser(response.data);
  },

  updateProfile: async (data: { name?: string; email?: string }): Promise<User> => {
    const response = await axiosInstance.put<any>("/auth/profile", data);
    return mapUser(response.data);
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout");
  },
};

// ========================
// Documents API
// ========================
const documents = {
  upload: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axiosInstance.post<any>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return mapDocument(response.data);
  },

  list: async (params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    search?: string;
  }): Promise<DocumentListResponse> => {
    const response = await axiosInstance.get<any>("/documents", { params });
    return {
      documents: (response.data.documents || []).map(mapDocument),
      total: response.data.total || 0,
      page: response.data.page || 1,
      pageSize: response.data.pageSize || 10,
    };
  },

  get: async (id: string): Promise<Document> => {
    const response = await axiosInstance.get<any>(`/document/${id}`);
    return mapDocument(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/document/${id}`);
  },

  getPages: async (id: string): Promise<ParsedPage[]> => {
    const response = await axiosInstance.get<any[]>(`/document/${id}/pages`);
    return response.data.map((p: any) => ({
      id: p.id ? p.id.toString() : "",
      documentId: p.document_id ? p.document_id.toString() : "",
      pageNumber: p.page_number || 0,
      rawText: p.extracted_text || "",
      imageUrl: p.page_image_path || "",
      thumbnailUrl: p.page_image_path || "",
      wordCount: p.word_count || 0,
    }));
  },

  getStatus: async (id: string): Promise<DocumentStatusResponse> => {
    const response = await axiosInstance.get<any>(`/document/${id}/status`);
    const data = response.data;
    
    let frontendStatus = DocumentStatus.UPLOADING;
    if (data.status === "indexed") frontendStatus = DocumentStatus.INDEXED;
    else if (data.status === "failed") frontendStatus = DocumentStatus.ERROR;
    else if (data.status === "parsing") frontendStatus = DocumentStatus.PARSING;
    else if (data.status === "ocr_processing") frontendStatus = DocumentStatus.OCR_PROCESSING;
    else if (data.status === "classifying") frontendStatus = DocumentStatus.CLASSIFYING;
    else if (data.status === "creating_embeddings") frontendStatus = DocumentStatus.CREATING_EMBEDDINGS;
    else if (data.status === "uploaded") frontendStatus = DocumentStatus.UPLOADING;

    return {
      id: data.document_id ? data.document_id.toString() : id,
      status: frontendStatus,
      progress: data.progress_pct !== undefined ? data.progress_pct : 0,
      message: data.error_message || undefined,
    };
  },
};

// ========================
// Chat API
// ========================
const chat = {
  ask: async (data: ChatRequest): Promise<ChatResponse> => {
    // Map frontend ChatRequest to backend ChatRequest structure
    const backendRequest = {
      question: data.message,
      session_id: data.sessionId || "",
      document_ids: data.documentIds ? data.documentIds.map(id => parseInt(id)) : [],
    };

    const response = await axiosInstance.post<any>("/ask", backendRequest);
    
    // Map backend ChatResponse to frontend ChatResponse structure
    return {
      sessionId: response.data.session_id,
      message: {
        id: generateId(),
        sessionId: response.data.session_id,
        role: MessageRole.ASSISTANT,
        content: response.data.answer,
        createdAt: new Date().toISOString(),
      },
      citations: (response.data.citations || []).map((c: any) => ({
        id: `${c.document_id || 0}_${c.page_number || 0}_${generateId().substring(0, 5)}`,
        documentId: (c.document_id || 0).toString(),
        documentName: c.document_name || "",
        pageNumber: c.page_number || 0,
        excerpt: c.chunk_text || "",
        thumbnailUrl: c.page_image_url || c.page_image_path || "",
        imageUrl: c.page_image_url || c.page_image_path || "",
        confidence: c.relevance_score || 0.8,
      })),
    };
  },

  getHistory: async (sessionId: string): Promise<ChatMessage[]> => {
    const response = await axiosInstance.get<any[]>(`/chat-history/${sessionId}`);
    
    // Map backend ChatHistoryItem to frontend ChatMessage structure
    return response.data.map((h: any) => ({
      id: h.id.toString(),
      sessionId: h.session_id,
      role: h.role === "user" ? MessageRole.USER : MessageRole.ASSISTANT,
      content: h.message,
      createdAt: h.created_at,
      citations: h.citations ? h.citations.map((c: any) => ({
        id: `${c.document_id || 0}_${c.page_number || 0}_${generateId().substring(0, 5)}`,
        documentId: (c.document_id || 0).toString(),
        documentName: c.document_name || "",
        pageNumber: c.page_number || 0,
        excerpt: c.chunk_text || "",
        thumbnailUrl: c.page_image_url || c.page_image_path || "",
        imageUrl: c.page_image_url || c.page_image_path || "",
        confidence: c.relevance_score || 0.8,
      })) : undefined,
    }));
  },

  getSessions: async (): Promise<ChatSession[]> => {
    const response = await axiosInstance.get<any[]>("/chat-sessions");
    
    // Map backend ChatSessionInfo to frontend ChatSession structure
    return response.data.map((s: any) => ({
      id: s.session_id,
      userId: "",
      title: s.first_message || "Conversation Session",
      messageCount: s.message_count,
      lastMessage: s.first_message || "",
      createdAt: s.last_activity,
      updatedAt: s.last_activity,
    }));
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    await axiosInstance.delete(`/chat-history/${sessionId}`);
  },

  createSession: async (title?: string, documentIds?: string[]): Promise<ChatSession> => {
    const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    return {
      id: sessionId,
      userId: "",
      title: title || "New Chat",
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
};

// ========================
// Analytics API
// ========================
const analytics = {
  getDashboard: async (): Promise<AnalyticsData> => {
    const response = await axiosInstance.get<any>("/analytics/dashboard");
    return mapAnalytics(response.data);
  },
};

// ========================
// Voice API
// ========================
const voice = {
  transcribe: async (audioBlob: Blob): Promise<VoiceTranscribeResponse> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    const response = await axiosInstance.post<VoiceTranscribeResponse>("/voice/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

export const api = {
  auth,
  documents,
  chat,
  analytics,
  voice,
};

export default axiosInstance;
