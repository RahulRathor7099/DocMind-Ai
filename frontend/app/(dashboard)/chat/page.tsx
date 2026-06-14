"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  FileText, 
  ArrowRight, 
  Clock,
  Sparkles,
  Info,
  Database,
  ArrowUpRight
} from "lucide-react";
import { api } from "@/lib/api";
import { ChatSession, Document } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import Link from "next/link";

export default function ChatDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Load sessions and documents in parallel
        const [sessionsData, docsResponse] = await Promise.all([
          api.chat.getSessions(),
          api.documents.list({ pageSize: 100 }),
        ]);
        
        setSessions(sessionsData);
        // Only allow chatting with successfully indexed documents
        setDocuments(docsResponse.documents.filter(doc => doc.status === "indexed"));
      } catch (err) {
        console.error(err);
        toast({
          title: "Failed to load chat data",
          description: "Could not retrieve your previous chat sessions or documents.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      const title = selectedDocs.length > 0 
        ? `Chat about ${selectedDocs.length} doc(s)`
        : "General Document Chat";
      
      const newSession = await api.chat.createSession(title, selectedDocs);
      
      toast({
        title: "Session created",
        description: "Redirecting to your new conversation...",
      });
      
      let url = `/chat/${newSession.id}`;
      if (selectedDocs.length > 0) {
        url += `?docs=${selectedDocs.join(",")}`;
      }
      
      router.push(url);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to create chat session",
        description: "Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      await api.chat.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({
        title: "Session deleted",
        description: "Chat history cleared successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to delete session",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => 
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAllDocs = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(d => d.id));
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black text-white p-6 lg:p-8">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-purple-200 to-blue-300 bg-clip-text text-transparent flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              Agentic RAG Chat
            </h1>
            <p className="text-white/60 mt-2 text-sm max-w-2xl">
              Interact with your document intelligence system. Ask complex questions across multiple files,
              and receive responses grounded in direct page-level citations.
            </p>
          </div>
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Start New Chat
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document selection panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-5 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-400" />
                  Target Documents
                </h2>
                {documents.length > 0 && (
                  <button
                    onClick={toggleAllDocs}
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {selectedDocs.length === documents.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                Select which files the AI agent should retrieve context from. If none are selected, the agent searches across all your files.
              </p>

              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {documents.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                    <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/50">No indexed documents</p>
                    <Link
                      href="/upload"
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors mt-2 inline-flex items-center gap-0.5"
                    >
                      Upload files <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  documents.map((doc) => {
                    const isSelected = selectedDocs.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                            : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-purple-600 border-purple-500 text-white"
                              : "border-white/20"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 fill-current"
                              viewBox="0 0 20 20"
                            >
                              <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                            </svg>
                          )}
                        </div>
                        <FileText className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-purple-400" : "text-white/40"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {doc.originalFilename}
                          </p>
                          <span className="text-[10px] text-white/30 font-medium">
                            {doc.pageCount} page{doc.pageCount !== 1 && "s"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {selectedDocs.length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-purple-300">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Searching restricted to <strong>{selectedDocs.length}</strong> selected document(s).
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chat sessions panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-5 border border-white/5 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Recent Conversations
              </h2>

              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                    <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/50 max-w-sm mx-auto">
                      No previous chat sessions found. Start a new chat session to query your document database.
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/chat/${session.id}`}
                      className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-purple-500/20 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                            {session.title || "Untitled Conversation"}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-white/40">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatRelativeTime(session.updatedAt)}
                            </span>
                            <span>•</span>
                            <span>
                              {session.messageCount} message{session.messageCount !== 1 && "s"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-2 rounded-lg text-white/20 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
