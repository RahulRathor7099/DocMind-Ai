"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Orb {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

export function AnimatedBackground() {
  const [orbs, setOrbs] = useState<Orb[]>([]);

  useEffect(() => {
    const orbConfigs: Orb[] = [
      { id: 1, x: 15, y: 20, size: 400, color: "rgba(124, 58, 237, 0.15)", duration: 8, delay: 0 },
      { id: 2, x: 75, y: 60, size: 350, color: "rgba(37, 99, 235, 0.12)", duration: 10, delay: 2 },
      { id: 3, x: 45, y: 80, size: 300, color: "rgba(168, 85, 247, 0.1)", duration: 12, delay: 4 },
      { id: 4, x: 85, y: 15, size: 250, color: "rgba(59, 130, 246, 0.1)", duration: 9, delay: 1 },
      { id: 5, x: 30, y: 50, size: 200, color: "rgba(124, 58, 237, 0.08)", duration: 11, delay: 3 },
    ];
    setOrbs(orbConfigs);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124, 58, 237, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124, 58, 237, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {/* Floating orbs */}
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
