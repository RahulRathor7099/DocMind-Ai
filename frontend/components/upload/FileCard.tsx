"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  Image,
  File,
  X,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { UploadProgress, DocumentStatus } from "@/lib/types";
import { formatFileSize, cn } from "@/lib/utils";

interface FileCardProps {
  file: UploadProgress;
  onRemove: (fileId: string) => void;
}

const statusConfig: Record<
  DocumentStatus,
  { label: string; color: string; className: string }
> = {
  [DocumentStatus.UPLOADING]: {
    label: "Uploading...",
    color: "from-purple-600 to-blue-600",
    className: "badge-uploading",
  },
  [DocumentStatus.PARSING]: {
    label: "Parsing document...",
    color: "from-blue-600 to-cyan-600",
    className: "badge-processing",
  },
  [DocumentStatus.OCR_PROCESSING]: {
    label: "OCR Processing...",
    color: "from-violet-600 to-purple-600",
    className: "badge-processing",
  },
  [DocumentStatus.CLASSIFYING]: {
    label: "Classifying with AI...",
    color: "from-indigo-600 to-violet-600",
    className: "badge-processing",
  },
  [DocumentStatus.CREATING_EMBEDDINGS]: {
    label: "Creating embeddings...",
    color: "from-blue-600 to-indigo-600",
    className: "badge-processing",
  },
  [DocumentStatus.INDEXED]: {
    label: "Indexed ✓",
    color: "from-green-600 to-emerald-600",
    className: "badge-indexed",
  },
  [DocumentStatus.ERROR]: {
    label: "Error",
    color: "from-red-600 to-red-700",
    className: "badge-error",
  },
};

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg"].includes(ext)) return <Image className="w-5 h-5 text-green-400" />;
  if (ext === "pdf") return <FileText className="w-5 h-5 text-red-400" />;
  if (["docx", "doc"].includes(ext)) return <FileText className="w-5 h-5 text-purple-400" />;
  return <File className="w-5 h-5 text-blue-400" />;
}

export function FileCard({ file, onRemove }: FileCardProps) {
  const config = statusConfig[file.status] || statusConfig[DocumentStatus.UPLOADING];
  const isComplete = file.status === DocumentStatus.INDEXED;
  const isError = file.status === DocumentStatus.ERROR;
  const isProcessing = !isComplete && !isError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "glass-card p-4 border transition-all duration-300",
        isComplete
          ? "border-green-500/20 bg-green-500/5"
          : isError
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
          {isComplete ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <FileIcon filename={file.filename} />
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-white truncate">{file.filename}</p>
            <button
              onClick={() => onRemove(file.fileId)}
              className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-white/40">{formatFileSize(file.size)}</span>
            <span className="text-white/20">•</span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.className)}>
              {config.label}
            </span>
          </div>

          {/* Progress bar */}
          {!isError && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40">
                <span>{isComplete ? "Complete" : "Processing"}</span>
                <span>{file.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isComplete
                      ? "bg-gradient-to-r from-green-500 to-emerald-400"
                      : "progress-gradient"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${file.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {isError && file.error && (
            <p className="text-xs text-red-400 mt-1">{file.error}</p>
          )}

          {/* View document link */}
          {isComplete && file.documentId && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2"
            >
              <Link href={`/documents/${file.documentId}`}>
                <button className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View in Documents
                </button>
              </Link>
            </motion.div>
          )}

          {/* Processing animation */}
          {isProcessing && (
            <div className="flex items-center gap-1.5 mt-2">
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
              <span className="text-xs text-white/30">
                {file.status === DocumentStatus.CREATING_EMBEDDINGS
                  ? "Almost there..."
                  : "Processing..."}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
