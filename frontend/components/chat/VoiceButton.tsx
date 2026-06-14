"use client";

import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  isRecording: boolean;
  isSupported: boolean;
  onClick: () => void;
  className?: string;
}

export function VoiceButton({
  isRecording,
  isSupported,
  onClick,
  className,
}: VoiceButtonProps) {
  if (!isSupported) {
    return (
      <div
        className={cn(
          "p-3 rounded-xl bg-white/5 border border-white/5 text-white/20 cursor-not-allowed",
          className
        )}
        title="Speech recognition is not supported in this browser"
      >
        <MicOff className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isRecording && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl bg-purple-500/20"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl bg-purple-500/10"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "easeOut",
              delay: 0.3,
            }}
          />
        </>
      )}
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer",
          isRecording
            ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            : "bg-white/5 text-white/70 border-white/10 hover:border-purple-500/30 hover:bg-white/10",
          className
        )}
        title={isRecording ? "Stop voice input" : "Start voice input"}
      >
        <Mic className={cn("w-5 h-5", isRecording && "animate-pulse")} />
      </motion.button>
    </div>
  );
}
