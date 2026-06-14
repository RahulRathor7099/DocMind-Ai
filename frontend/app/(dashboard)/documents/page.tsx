"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Document, DocumentStatus } from "@/lib/types";
import {
  Search,
  Filter,
  FileText,
  Image,
  File,
  ChevronDown,
  Loader2,
  Trash2,
  Eye,
  Calendar,
  Tag,
  AlertCircle,
} from "lucide-react";
import { formatRelativeTime, formatFileSize, getFileTypeFromMime, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3 } },
};

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType?.startsWith("image/")) return <Image className="w-6 h-6 text-green-400" />;
  if (mimeType === "application/pdf") return <FileText className="w-6 h-6 text-red-400" />;
  if (mimeType?.includes("word")) return <FileText className="w-6 h-6 text-purple-400" />;
  return <File className="w-6 h-6 text-blue-400" />;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config: Record<string, { label: string; className: string }> = {
    [DocumentStatus.INDEXED]: { label: "Indexed", className: "badge-indexed" },
    [DocumentStatus.ERROR]: { label: "Error", className: "badge-error" },
    [DocumentStatus.UPLOADING]: { label: "Uploading", className: "badge-uploading" },
  };
  const c = config[status] || { label: "Processing", className: "badge-processing" };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", c.className)}>
      {c.label}
    </span>
  );
}

const TYPE_OPTIONS = ["All", "PDF", "PNG", "JPG", "TXT", "DOCX"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.documents.list({
        search: search || undefined,
        type: selectedType !== "All" ? selectedType : undefined,
      });
      setDocuments(response.documents);
    } catch {
      toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedType]);

  useEffect(() => {
    const debounce = setTimeout(loadDocuments, 300);
    return () => clearTimeout(debounce);
  }, [loadDocuments]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.documents.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Document deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-white">Document Library</h1>
          <p className="text-white/50 mt-1">
            {documents.length} document{documents.length !== 1 ? "s" : ""} in your library
          </p>
        </div>
        <Link href="/upload">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 relative z-10"
          >
            <FileText className="w-4 h-4" />
            Upload
          </motion.button>
        </Link>
      </motion.div>

      {/* Search + Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full input-dark pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 glass-card px-4 py-2.5 text-sm text-white/70 hover:text-white border border-white/10 hover:border-purple-500/30 transition-all rounded-xl"
          >
            <Filter className="w-4 h-4" />
            {selectedType}
            <ChevronDown className={cn("w-4 h-4 transition-transform", isFilterOpen && "rotate-180")} />
          </button>
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute right-0 top-12 w-36 glass-card py-1 z-50 border border-white/10"
              >
                {TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setIsFilterOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2 text-sm text-left transition-all",
                      selectedType === type
                        ? "text-purple-400 bg-purple-500/10"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white/50 mb-2">No documents found</h3>
          <p className="text-sm text-white/30">
            {search ? "Try a different search term" : "Upload your first document to get started"}
          </p>
          {!search && (
            <Link href="/upload">
              <button className="mt-4 btn-gradient px-6 py-2.5 rounded-xl text-sm font-semibold relative z-10">
                Upload Document
              </button>
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {documents.map((doc) => (
            <motion.div key={doc.id} variants={cardVariants} layout>
              <Link href={`/documents/${doc.id}`}>
                <div className="glass-card-hover p-5 cursor-pointer group h-full">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                      <FileTypeIcon mimeType={doc.mimeType} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.status} />
                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-white text-sm mb-2 truncate group-hover:text-purple-300 transition-colors">
                    {doc.originalFilename}
                  </h3>

                  {/* Classification tags */}
                  {doc.classification?.tags && doc.classification.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {doc.classification.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-white/40 mt-auto pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatRelativeTime(doc.uploadedAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{doc.pageCount} pages</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                    </div>
                  </div>

                  {/* Category badge */}
                  {doc.classification?.category && (
                    <div className="mt-2 text-xs text-white/30 font-medium">
                      {doc.classification.category}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
