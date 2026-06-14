"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  MessageSquare, 
  Plus, 
  Database,
  FileText,
  Trash2,
  Sparkles,
  ChevronDown,
  Search,
  BookOpen,
  HelpCircle,
  Menu,
  ChevronRight
} from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useVoice } from "@/hooks/useVoice";
import { api } from "@/lib/api";
import { Document, ChatSession } from "@/lib/types";
import { MessageBubble, TypingIndicator } from "@/components/chat/MessageBubble";
import { PagePreviewModal } from "@/components/chat/PagePreviewModal";
import { VoiceButton } from "@/components/chat/VoiceButton";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

interface ChatSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  
  // Read document filters from query params if starting a new chat
  const docIdsParam = searchParams.get("docs");
  const initialDocIds = docIdsParam ? docIdsParam.split(",") : [];

  const {
    messages,
    sessions,
    currentSessionId,
    isLoading,
    isTyping,
    error,
    selectedDocumentIds,
    messagesEndRef,
    setSelectedDocumentIds,
    sendMessage,
    loadHistory,
    loadSessions,
    deleteSession,
    startNewChat,
  } = useChat({
    sessionId: sessionId === "new" ? undefined : sessionId,
    documentIds: initialDocIds,
  });

  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(false);

  // Initialize voice recognition
  const {
    isRecording,
    isSupported,
    toggleRecording,
  } = useVoice({
    onTranscript: (text) => {
      setInput((prev) => prev + (prev ? " " : "") + text);
    },
  });

  // Load sessions and documents
  useEffect(() => {
    loadSessions();
    const loadDocs = async () => {
      try {
        const response = await api.documents.list({ pageSize: 100 });
        setDocuments(response.documents.filter(d => d.status === "indexed"));
      } catch (err) {
        console.error(err);
      }
    };
    loadDocs();
  }, [loadSessions]);

  // Load history when sessionId changes
  useEffect(() => {
    if (sessionId && sessionId !== "new") {
      loadHistory(sessionId);
    } else {
      startNewChat();
      // If docs are passed in query params, update state
      if (initialDocIds.length > 0) {
        setSelectedDocumentIds(initialDocIds);
      }
    }
  }, [sessionId, loadHistory, startNewChat]);

  // Route replacement when a new session ID is generated on first message
  useEffect(() => {
    if (currentSessionId && currentSessionId !== sessionId) {
      router.replace(`/chat/${currentSessionId}`);
    }
  }, [currentSessionId, sessionId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input;
    setInput("");
    await sendMessage(query);
  };

  const handleDocCheckboxChange = (docId: string) => {
    setSelectedDocumentIds(
      selectedDocumentIds.includes(docId)
        ? selectedDocumentIds.filter(id => id !== docId)
        : [...selectedDocumentIds, docId]
    );
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      await deleteSession(id);
      toast({
        title: "Session deleted",
        description: "Chat history cleared successfully.",
      });
      if (sessionId === id) {
        router.push("/chat/new");
      }
    } catch {
      toast({
        title: "Failed to delete session",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter documents by search term
  const filteredDocs = documents.filter(d => 
    d.originalFilename.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-80px)] bg-black text-white flex relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/5 rounded-full blur-3xl pointer-events-none" />

      {/* Local chat history sidebar (desktop standard, mobile slide-over) */}
      <div
        className={`w-72 border-r border-white/5 bg-[#050508] flex-shrink-0 flex flex-col transition-all z-20 absolute md:relative inset-y-0 left-0 ${
          showSessionsSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <Link
            href="/chat/new"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs transition-all cursor-pointer"
            onClick={() => setShowSessionsSidebar(false)}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2">
            Conversations
          </span>
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/30">
              No conversations yet.
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === sessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    router.push(`/chat/${s.id}`);
                    setShowSessionsSidebar(false);
                  }}
                  className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-purple-500/10 border-purple-500/30 text-white shadow-[0_0_10px_rgba(168,85,247,0.05)]"
                      : "bg-transparent border-transparent text-white/60 hover:bg-white/[0.02] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-purple-400" : "text-white/30"}`} />
                    <span className="text-xs font-semibold truncate">
                      {s.title || "Conversation Session"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Overlay to close sidebar on mobile */}
      {showSessionsSidebar && (
        <div
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
          onClick={() => setShowSessionsSidebar(false)}
        />
      )}

      {/* Main chat window */}
      <div className="flex-1 flex flex-col min-w-0 bg-black relative">
        {/* Chat header */}
        <div className="h-16 border-b border-white/5 px-4 md:px-6 flex items-center justify-between bg-black/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionsSidebar(!showSessionsSidebar)}
              className="p-2 rounded-lg bg-white/5 border border-white/5 md:hidden text-white/70 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">DocMind Chat</span>
              <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                Gemini 1.5 Flash
              </span>
            </div>
          </div>

          {/* Document selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDocSelector(!showDocSelector)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all font-medium cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>
                {selectedDocumentIds.length === 0
                  ? "All Documents"
                  : `${selectedDocumentIds.length} Document${selectedDocumentIds.length !== 1 ? "s" : ""}`}
              </span>
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>

            <AnimatePresence>
              {showDocSelector && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowDocSelector(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 glass-card p-4 border border-white/10 rounded-2xl z-30 shadow-2xl bg-[#09090d]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-white">Select Chat Target</span>
                      {selectedDocumentIds.length > 0 && (
                        <button
                          onClick={() => setSelectedDocumentIds([])}
                          className="text-[10px] font-semibold text-purple-400 hover:text-purple-300"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    {/* Search bar inside selector */}
                    <div className="relative mb-3">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    {/* List of docs with checkboxes */}
                    <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                      {filteredDocs.length === 0 ? (
                        <div className="text-center py-4 text-xs text-white/30">
                          {documents.length === 0 ? (
                            <>
                              No documents available.<br />
                              <Link href="/upload" className="text-purple-400 hover:underline mt-1 inline-block">
                                Upload now
                              </Link>
                            </>
                          ) : (
                            "No matching documents"
                          )}
                        </div>
                      ) : (
                        filteredDocs.map((doc) => {
                          const isSelected = selectedDocumentIds.includes(doc.id);
                          return (
                            <div
                              key={doc.id}
                              onClick={() => handleDocCheckboxChange(doc.id)}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-purple-500/5 border-purple-500/20 text-white"
                                  : "bg-transparent border-transparent text-white/50 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                                  isSelected
                                    ? "bg-purple-600 border-purple-500 text-white"
                                    : "border-white/20"
                                  }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-2.5 h-2.5 fill-current"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                  </svg>
                                )}
                              </div>
                              <FileText className="w-3.5 h-3.5 flex-shrink-0 text-white/30" />
                              <span className="text-xs font-semibold truncate flex-1">
                                {doc.originalFilename}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-3 text-[10px] text-white/40 leading-relaxed">
                      Only messages matching selected files are sent. Uncheck all to search all indexes.
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Messages viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
              <div className="p-4 rounded-3xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mb-4 animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">DocMind AI Assistant</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-6">
                Ask a question to search your document indices. The agent parses classifications, tables,
                and extracts grounded context with visual citations.
              </p>
              
              {documents.length > 0 && selectedDocumentIds.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/10 text-xs text-purple-300 w-full flex items-start gap-2.5">
                  <Database className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <span className="font-semibold block">Target Search Enabled</span>
                    Searching queries restricted to <span className="underline">{selectedDocumentIds.length} specified document(s)</span>.
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCitationClick={(url) => setPreviewImageUrl(url)}
              />
            ))
          )}

          {isTyping && <TypingIndicator />}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 max-w-sm mx-auto text-center">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input panel */}
        <div className="p-4 border-t border-white/5 bg-black/80 backdrop-blur-md relative z-10">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2.5">
            <div className="flex-1 relative glass-card border border-white/10 rounded-2xl p-1 bg-white/[0.02] hover:border-white/20 focus-within:border-purple-500/50 transition-all flex items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={1}
                placeholder="Ask anything about your documents..."
                className="w-full bg-transparent resize-none focus:outline-none text-sm text-white px-3 py-2.5 max-h-36 min-h-[40px] custom-scrollbar placeholder-white/30"
              />
              
              {/* Voice recognition button */}
              <div className="p-1.5 flex-shrink-0">
                <VoiceButton
                  isRecording={isRecording}
                  isSupported={isSupported}
                  onClick={toggleRecording}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:from-purple-600 disabled:hover:to-blue-600 shadow-[0_0_15px_rgba(124,58,237,0.2)] hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Voice recording indicators */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-purple-950/80 backdrop-blur-lg border border-purple-500/20 rounded-xl flex items-center gap-3 text-xs max-w-md mx-auto shadow-2xl"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-purple-300 block">Speech Engine Listening...</span>
                  <span className="text-white/40 block truncate">Speak now; transcription outputs append to textbox.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImageUrl && (
          <PagePreviewModal
            imageUrl={previewImageUrl}
            onClose={() => setPreviewImageUrl(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
