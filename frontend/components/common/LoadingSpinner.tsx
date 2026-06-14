"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  const sizes = {
    sm: { outer: 24, inner: 16, border: 2 },
    md: { outer: 40, inner: 28, border: 3 },
    lg: { outer: 64, inner: 48, border: 4 },
  };

  const s = sizes[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative" style={{ width: s.outer, height: s.outer }}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${s.border}px solid rgba(124, 58, 237, 0.2)`,
          }}
        />
        {/* Spinning gradient arc */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${s.border}px solid transparent`,
            borderTopColor: "#7c3aed",
            borderRightColor: "#2563eb",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
        {/* Inner pulsing dot */}
        <motion.div
          className="absolute rounded-full bg-gradient-to-br from-purple-500 to-blue-500"
          style={{
            width: s.inner * 0.3,
            height: s.inner * 0.3,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {text && (
        <motion.p
          className="text-sm text-white/50"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 opacity-20 blur-lg" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <span className="text-2xl font-black text-white">D</span>
            </div>
          </div>
        </motion.div>
        <LoadingSpinner size="md" text="Loading DocMind AI..." />
      </div>
    </div>
  );
}
