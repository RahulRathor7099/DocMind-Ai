"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Document, ParsedPage } from "@/lib/types";
import {
  ArrowLeft,
  FileText,
  Tag,
  Calendar,
  BarChart,
  BookOpen,
  AlignLeft,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  MessageSquare,
} from "lucide-react";
import { formatDate, formatFileSize, cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>;
}

function PageModal({
  page,
  onClose,
}: {
  page: ParsedPage;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-4xl w-full max-h-[90vh] glass-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="text-sm font-medium text-white/70">Page {page.pageNumber}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Image or text */}
        <div className="overflow-auto max-h-[80vh] p-6 flex items-center justify-center">
          {page.imageUrl ? (
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}>
              <img
                src={page.imageUrl}
                alt={`Page ${page.pageNumber}`}
                className="max-w-full rounded-lg"
              />
            </div>
          ) : (
            <div className="max-w-2xl w-full">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {page.rawText}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = use(params);
  const [document, setDocument] = useState<Document | null>(null);
  const [pages, setPages] = useState<ParsedPage[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "pages" | "text">("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<ParsedPage | null>(null);
  const [searchText, setSearchText] = useState("");
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const [doc, pageList] = await Promise.all([
          api.documents.get(id),
          api.documents.getPages(id),
        ]);
        setDocument(doc);
        setPages(pageList);
      } catch {
        router.push("/documents");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!document) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart },
    { id: "pages", label: `Pages (${pages.length})`, icon: BookOpen },
    { id: "text", label: "Raw Text", icon: AlignLeft },
  ] as const;

  const filteredPages = searchText
    ? pages.filter((p) =>
        p.rawText?.toLowerCase().includes(searchText.toLowerCase())
      )
    : pages;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back button */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Link href="/documents">
          <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Documents
          </button>
        </Link>
      </motion.div>

      {/* Document header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border border-white/5"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-7 h-7 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white mb-2 truncate">
              {document.originalFilename}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(document.uploadedAt)}
              </div>
              <span>•</span>
              <span>{document.pageCount} pages</span>
              <span>•</span>
              <span>{formatFileSize(document.fileSize)}</span>
            </div>

            {/* Classification tags */}
            {document.classification?.tags && document.classification.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {document.classification.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Summary */}
            {document.classification?.summary && (
              <p className="mt-3 text-sm text-white/60 leading-relaxed line-clamp-3">
                {document.classification.summary}
              </p>
            )}
          </div>

          {/* Chat button */}
          <Link href={`/chat?documentId=${document.id}`}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 relative z-10 flex-shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with Doc
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card p-1 rounded-xl border border-white/5 w-fit">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tabId
                ? "bg-purple-600 text-white shadow-lg"
                : "text-white/50 hover:text-white"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[
              { label: "Category", value: document.classification?.category || "N/A" },
              { label: "Subcategory", value: document.classification?.subcategory || "N/A" },
              { label: "Language", value: document.classification?.language || "N/A" },
              { label: "Confidence", value: document.classification ? `${(document.classification.confidence * 100).toFixed(0)}%` : "N/A" },
              { label: "Embeddings", value: document.embeddingCount?.toLocaleString() || "0" },
              { label: "Processed", value: document.processedAt ? formatDate(document.processedAt) : "N/A" },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card p-4 border border-white/5">
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-1">{label}</p>
                <p className="text-white font-semibold">{value}</p>
              </div>
            ))}

            {/* Key entities */}
            {document.classification?.keyEntities && document.classification.keyEntities.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3 glass-card p-4 border border-white/5">
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">Key Entities</p>
                <div className="flex flex-wrap gap-2">
                  {document.classification.keyEntities.map((entity) => (
                    <span
                      key={entity}
                      className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "pages" && (
          <motion.div
            key="pages"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
          >
            {pages.map((page) => (
              <motion.div
                key={page.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPage(page)}
                className="glass-card p-2 cursor-pointer border border-white/5 hover:border-purple-500/30 group transition-all"
              >
                {page.thumbnailUrl ? (
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white/5 mb-2">
                    <img
                      src={page.thumbnailUrl}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[3/4] rounded-lg bg-white/5 flex items-center justify-center mb-2">
                    <FileText className="w-8 h-8 text-white/20" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Page {page.pageNumber}</span>
                  <ZoomIn className="w-3 h-3 text-white/20 group-hover:text-purple-400 transition-colors" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === "text" && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search in text..."
                className="w-full input-dark pl-10 pr-4 py-2.5 text-sm"
              />
            </div>

            <div className="space-y-4">
              {filteredPages.map((page) => (
                <div key={page.id} className="glass-card p-5 border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-purple-300">
                      Page {page.pageNumber}
                    </span>
                    <span className="text-xs text-white/30">• {page.wordCount} words</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                    {page.rawText || "No text extracted from this page."}
                  </p>
                </div>
              ))}
              {filteredPages.length === 0 && (
                <div className="text-center py-10 text-white/30">
                  No matches found for "{searchText}"
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page preview modal */}
      <AnimatePresence>
        {selectedPage && (
          <PageModal page={selectedPage} onClose={() => setSelectedPage(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
