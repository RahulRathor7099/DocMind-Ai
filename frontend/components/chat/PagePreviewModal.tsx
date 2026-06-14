"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useState } from "react";

interface PagePreviewModalProps {
  imageUrl: string;
  onClose: () => void;
}

export function PagePreviewModal({ imageUrl, onClose }: PagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((z) => Math.min(4, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));
  const handleReset = () => { setZoom(1); setRotation(0); };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex flex-col"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between p-4 bg-black/50 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-white/50 font-medium">Page Preview</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/50 w-12 text-center bg-white/5 px-2 py-1 rounded-lg">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            Reset
          </button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          style={{
            scale: zoom,
            rotate: rotation,
            transformOrigin: "center center",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <img
            src={imageUrl}
            alt="Page preview"
            className="max-w-full rounded-xl shadow-2xl"
            style={{ maxHeight: "80vh" }}
          />
        </motion.div>
      </div>

      {/* Close hint */}
      <div className="text-center pb-4">
        <span className="text-xs text-white/20">Click outside or press Escape to close</span>
      </div>
    </motion.div>
  );
}
