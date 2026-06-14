"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { ChatMessage, ChatSession, MessageRole, Citation } from "@/lib/types";
import { generateId } from "@/lib/utils";

interface UseChatOptions {
  sessionId?: string;
  documentIds?: string[];
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(
    options.sessionId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    options.documentIds || []
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const history = await api.chat.getHistory(sessionId);
      setMessages(history);
      setCurrentSessionId(sessionId);
    } catch {
      setError("Failed to load chat history");
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.chat.getSessions();
      setSessions(data);
    } catch {
      setError("Failed to load sessions");
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: generateId(),
        sessionId: currentSessionId || "",
        role: MessageRole.USER,
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      setIsLoading(true);
      scrollToBottom();

      try {
        const response = await api.chat.ask({
          sessionId: currentSessionId,
          message: content,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        });

        const aiMessage: ChatMessage = {
          ...response.message,
          citations: response.citations,
          sessionId: response.sessionId,
        };

        setCurrentSessionId(response.sessionId);
        setMessages((prev) => {
          const withoutUser = prev.slice(0, -1);
          return [
            ...withoutUser,
            { ...userMessage, sessionId: response.sessionId },
            aiMessage,
          ];
        });

        // Refresh sessions list
        loadSessions();
        scrollToBottom();
      } catch {
        setError("Failed to send message. Please try again.");
        // Remove optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } finally {
        setIsTyping(false);
        setIsLoading(false);
      }
    },
    [currentSessionId, isLoading, selectedDocumentIds, scrollToBottom, loadSessions]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await api.chat.deleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(undefined);
          setMessages([]);
        }
      } catch {
        setError("Failed to delete session");
      }
    },
    [currentSessionId]
  );

  const startNewChat = useCallback(() => {
    setCurrentSessionId(undefined);
    setMessages([]);
    setError(null);
  }, []);

  const addCitation = useCallback(
    (messageId: string, citation: Citation) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, citations: [...(m.citations || []), citation] }
            : m
        )
      );
    },
    []
  );

  return {
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
    addCitation,
  };
}
