"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUpload } from "@/hooks/useUpload";
import { DropZone } from "@/components/upload/DropZone";
import { FileCard } from "@/components/upload/FileCard";
import { DocumentStatus } from "@/lib/types";
import { Trash2, CheckCircle2, Upload as UploadIcon } from "lucide-react";

export default function UploadPage() {
  const { uploadQueue, uploadFiles, removeFromQueue, clearCompleted } = useUpload();

  const completedCount = uploadQueue.filter(
    (f) => f.status === DocumentStatus.INDEXED
  ).length;
  const processingCount = uploadQueue.filter(
    (f) =>
      f.status !== DocumentStatus.INDEXED && f.status !== DocumentStatus.ERROR
  ).length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-black text-white">Upload Documents</h1>
        <p className="text-white/50 mt-1">
          Upload PDFs, images, and text documents for AI processing
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <DropZone
          onFilesSelected={uploadFiles}
          isUploading={processingCount > 0}
        />
      </motion.div>

      {/* Upload Queue */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Queue header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Upload Queue</h2>
                <div className="flex items-center gap-2">
                  {processingCount > 0 && (
                    <span className="badge-processing text-xs font-medium px-2 py-0.5 rounded-full">
                      {processingCount} processing
                    </span>
                  )}
                  {completedCount > 0 && (
                    <span className="badge-indexed text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {completedCount} indexed
                    </span>
                  )}
                </div>
              </div>
              {completedCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear completed
                </button>
              )}
            </div>

            {/* File cards */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {uploadQueue.map((file) => (
                  <FileCard
                    key={file.fileId}
                    file={file}
                    onRemove={removeFromQueue}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Processing note */}
            {processingCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20"
              >
                <UploadIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <p className="text-xs text-purple-300">
                  Documents are being processed. This page will automatically update as
                  each file progresses through the pipeline.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {uploadQueue.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-8 text-white/30"
        >
          <p className="text-sm">
            Files you upload will appear here with real-time processing status
          </p>
        </motion.div>
      )}
    </div>
  );
}
