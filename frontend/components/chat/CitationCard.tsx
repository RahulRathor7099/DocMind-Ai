"use client";

import { motion } from "framer-motion";
import { Citation } from "@/lib/types";
import { FileText, BookOpen, ExternalLink } from "lucide-react";
import { truncateText, cn } from "@/lib/utils";

interface CitationCardProps {
  citation: Citation;
  onPreviewClick?: (imageUrl: string) => void;
}

export function CitationCard({ citation, onPreviewClick }: CitationCardProps) {
  const hasImage = !!citation.thumbnailUrl || !!citation.imageUrl;
  const imageUrl = citation.thumbnailUrl || citation.imageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card border border-white/5 hover:border-purple-500/20 transition-all rounded-xl overflow-hidden"
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        {hasImage && imageUrl ? (
          <button
            onClick={() =>
              onPreviewClick?.(
                citation.imageUrl || citation.thumbnailUrl || ""
              )
            }
            className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border border-white/10"
          >
            <img
              src={imageUrl}
              alt={`Page ${citation.pageNumber}`}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/10">
            <FileText className="w-5 h-5 text-white/20" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <BookOpen className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-white truncate">
                {citation.documentName}
              </span>
            </div>
            <span className="text-xs font-medium text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full flex-shrink-0 border border-purple-500/20">
              p.{citation.pageNumber}
            </span>
          </div>

          <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
            {truncateText(citation.excerpt, 120)}
          </p>

          {/* Confidence */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1">
              <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  style={{ width: `${(citation.confidence || 0.8) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-white/30">
                {Math.round((citation.confidence || 0.8) * 100)}% match
              </span>
            </div>
            {hasImage && (
              <button
                onClick={() =>
                  onPreviewClick?.(
                    citation.imageUrl || citation.thumbnailUrl || ""
                  )
                }
                className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Preview
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
