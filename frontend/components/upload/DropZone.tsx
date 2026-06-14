"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CloudUpload, FileText, Image, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

const ACCEPTED_FORMATS = [
  { ext: "PDF", icon: FileText, color: "text-red-400" },
  { ext: "PNG", icon: Image, color: "text-green-400" },
  { ext: "JPG", icon: Image, color: "text-green-400" },
  { ext: "TXT", icon: FileText, color: "text-blue-400" },
  { ext: "DOCX", icon: FileText, color: "text-purple-400" },
];

const ACCEPTED_MIME = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

export function DropZone({ onFilesSelected, isUploading = false }: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isUploading,
    multiple: true,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden",
        isDragActive && !isDragReject
          ? "border-purple-500 bg-purple-500/10 scale-[1.01]"
          : isDragReject
          ? "border-red-500 bg-red-500/10"
          : "border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5",
        isUploading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />

      {/* Background glow on drag */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-purple-500/5 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Animated border corners */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-purple-500/50 rounded-tl-2xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500/50 rounded-tr-2xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-purple-500/50 rounded-bl-2xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-500/50 rounded-br-2xl" />

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Icon */}
        <motion.div
          animate={isDragActive ? { scale: 1.2, rotate: [0, -5, 5, 0] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 opacity-20 blur-xl scale-150" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 flex items-center justify-center">
            {isDragActive ? (
              <CloudUpload className="w-10 h-10 text-purple-400" />
            ) : (
              <Upload className="w-10 h-10 text-purple-400" />
            )}
          </div>
        </motion.div>

        {/* Text */}
        <div>
          <AnimatePresence mode="wait">
            {isDragActive ? (
              <motion.div
                key="dragging"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-xl font-bold text-purple-300">
                  {isDragReject ? "File type not supported" : "Release to upload!"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-xl font-bold text-white">
                  Drop files here or{" "}
                  <span className="gradient-text">click to browse</span>
                </p>
                <p className="text-white/40 text-sm mt-2">
                  Upload multiple files at once • Maximum 50MB per file
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Format badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {ACCEPTED_FORMATS.map((format) => {
            const Icon = format.icon;
            return (
              <div
                key={format.ext}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60"
              >
                <Icon className={`w-3.5 h-3.5 ${format.color}`} />
                {format.ext}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
