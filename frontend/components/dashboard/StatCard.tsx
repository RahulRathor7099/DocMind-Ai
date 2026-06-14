"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
  trend?: { value: number; isPositive: boolean };
  delay?: number;
}

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString() + suffix);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 1.5,
      ease: "easeOut",
      delay: 0.2,
    });
    return controls.stop;
  }, [count, target]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

export function StatCard({
  title,
  value,
  suffix = "",
  icon: Icon,
  color,
  glowColor,
  trend,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, boxShadow: `0 20px 40px ${glowColor}` }}
      className="glass-card p-6 cursor-default transition-all duration-300 border border-white/5 hover:border-white/10"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <div
            className={cn(
              "text-xs font-semibold px-2 py-1 rounded-full",
              trend.isPositive
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-3xl font-black text-white">
          <AnimatedNumber target={value} suffix={suffix} />
        </div>
        <p className="text-sm text-white/50 font-medium">{title}</p>
      </div>

      {/* Gradient line */}
      <div className={`mt-4 h-0.5 rounded-full bg-gradient-to-r ${color} opacity-30`} />
    </motion.div>
  );
}
