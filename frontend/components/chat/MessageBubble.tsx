"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatMessage, MessageRole } from "@/lib/types";
import { Brain, User, Copy, Check } from "lucide-react";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useState } from "react";
import { CitationCard } from "./CitationCard";

interface MessageBubbleProps {
  message: ChatMessage;
  onCitationClick?: (imageUrl: string) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === MessageRole.USER;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1",
        isUser
          ? "bg-gradient-to-br from-purple-600 to-blue-600"
          : "bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-purple-500/20"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Brain className="w-4 h-4 text-purple-400" />
        )}
      </div>

      {/* Message content */}
      <div className={cn("max-w-[80%] space-y-2", isUser ? "items-end" : "items-start")}>
        {/* Bubble */}
        <div className={cn(
          "relative rounded-2xl px-4 py-3",
          isUser
            ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-tr-sm"
            : "glass-card border border-white/10 text-white/90 rounded-tl-sm"
        )}>
          {/* Copy button (AI messages only) */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute -top-3 right-2 p-1.5 rounded-lg glass-card opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 text-white/50 hover:text-white"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          )}

          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const inline = !match;
                    return !inline ? (
                      <SyntaxHighlighter
                        style={oneDark as Record<string, React.CSSProperties>}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-lg text-xs my-2"
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-white/80">{children}</li>,
                  strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
                  h3: ({ children }) => <h3 className="text-white font-bold text-base mb-1 mt-2">{children}</h3>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-white/20 px-1">
          {formatRelativeTime(message.createdAt)}
        </span>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">
              Sources
            </p>
            {message.citations.map((citation) => (
              <CitationCard
                key={citation.id}
                citation={citation}
                onPreviewClick={onCitationClick}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Typing indicator
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
        <Brain className="w-4 h-4 text-purple-400" />
      </div>
      <div className="glass-card border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1.5">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </motion.div>
  );
}
