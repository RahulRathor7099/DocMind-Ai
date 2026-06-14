"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Upload,
  Eye,
  Tag,
  Search,
  Quote,
  BarChart3,
  CheckCircle,
  Zap,
  Shield,
  Brain,
  ChevronRight,
  Star,
  Play,
  FileText,
  Cpu,
  Database,
  MessageSquare,
} from "lucide-react";

// Particle component
function Particles() {
  const [particles, setParticles] = useState<Array<{
    id: number; x: number; y: number; size: number; opacity: number; duration: number;
  }>>([]);

  useEffect(() => {
    const p = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      duration: Math.random() * 10 + 5,
    }));
    setParticles(p);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-purple-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
}

const features = [
  {
    icon: Upload,
    title: "Smart Document Upload",
    description: "Drag & drop any file — PDF, PNG, JPG, DOCX, TXT. Up to 50MB instantly processed.",
    color: "from-purple-500 to-violet-600",
    glow: "rgba(124, 58, 237, 0.3)",
  },
  {
    icon: Eye,
    title: "Advanced OCR Engine",
    description: "Extract text from scanned documents, images, and complex layouts with 99.9% accuracy.",
    color: "from-blue-500 to-cyan-600",
    glow: "rgba(37, 99, 235, 0.3)",
  },
  {
    icon: Tag,
    title: "AI Classification",
    description: "GPT-4 powered automatic classification, tagging, and metadata extraction.",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139, 92, 246, 0.3)",
  },
  {
    icon: Search,
    title: "Vector Search",
    description: "Semantic search across all your documents. Find anything by meaning, not just keywords.",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(99, 102, 241, 0.3)",
  },
  {
    icon: MessageSquare,
    title: "AI Chat Interface",
    description: "Ask questions about your documents in natural language. Get cited, accurate answers.",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236, 72, 153, 0.3)",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track processing metrics, document insights, and usage analytics in real-time.",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16, 185, 129, 0.3)",
  },
];

const steps = [
  { icon: Upload, title: "Upload", description: "Drop your document into DocMind AI", color: "from-purple-600 to-violet-600" },
  { icon: Eye, title: "OCR Processing", description: "Our engine extracts all text with high accuracy", color: "from-blue-600 to-indigo-600" },
  { icon: Cpu, title: "AI Analysis", description: "GPT-4 classifies and understands your content", color: "from-violet-600 to-purple-600" },
  { icon: Database, title: "Vector Indexing", description: "Content is embedded for semantic search", color: "from-indigo-600 to-blue-600" },
  { icon: MessageSquare, title: "Chat & Query", description: "Ask questions, get cited answers instantly", color: "from-pink-600 to-rose-600" },
];

const stats = [
  { value: "99.9%", label: "OCR Accuracy", icon: CheckCircle },
  { value: "<2s", label: "Processing Time", icon: Zap },
  { value: "50MB", label: "File Size Limit", icon: Shield },
  { value: "GPT-4", label: "AI Engine", icon: Brain },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function LandingPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -50]);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 opacity-40 blur" />
              <img
                src="/logo.png"
                alt="DocMind AI Logo"
                className="relative w-9 h-9 rounded-xl object-cover"
              />
            </div>
            <span className="font-bold text-xl gradient-text">DocMind AI</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none font-semibold"
            >
              Features
            </button>
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none font-semibold"
            >
              How it works
            </button>
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer bg-transparent border-none outline-none font-semibold"
            >
              Sign in
            </button>
            <motion.button
              onClick={() => router.push("/signup")}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-gradient px-4 py-2 rounded-xl text-sm font-semibold relative z-10 cursor-pointer"
            >
              Get Started Free
            </motion.button>
          </div>
          <motion.button
            onClick={() => router.push("/signup")}
            className="md:hidden btn-gradient px-4 py-2 rounded-xl text-sm font-semibold relative z-10 cursor-pointer"
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-orb-float" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl animate-orb-float" style={{ animationDelay: "3s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl animate-orb-float" style={{ animationDelay: "6s" }} />
          <Particles />
        </div>

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 text-center px-4 max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-8 text-sm font-medium text-purple-300"
          >
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Powered by GPT-4 & Advanced OCR</span>
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] mb-6"
          >
            Turn Any Document
            <br />
            <span className="gradient-text">Into Intelligence</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload PDFs, images, and documents. DocMind AI extracts text with advanced OCR,
            classifies with GPT-4, creates vector embeddings, and lets you chat with your entire
            document library using AI.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              onClick={() => router.push("/signup")}
              whileHover={{ scale: 1.04, boxShadow: "0 25px 50px rgba(124, 58, 237, 0.5)" }}
              whileTap={{ scale: 0.96 }}
              className="btn-gradient px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 relative z-10 min-w-[200px] cursor-pointer"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={() => router.push("/login")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card px-8 py-4 rounded-2xl font-semibold text-lg flex items-center gap-3 text-white/80 hover:text-white border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              View Demo
            </motion.button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-white/40"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>5 documents free</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Setup in 60 seconds</span>
            </div>
          </motion.div>

          {/* Preview window */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
            <div className="glass-card p-1 border border-white/10 rounded-2xl overflow-hidden shadow-glow-purple">
              <div className="bg-[#0d0d1a] rounded-xl p-6 min-h-[300px] relative overflow-hidden">
                {/* Fake UI preview */}
                <div className="flex gap-4 h-full">
                  {/* Sidebar preview */}
                  <div className="w-48 bg-white/5 rounded-xl p-3 space-y-2 flex-shrink-0">
                    {["Dashboard", "Upload", "Documents", "Chat"].map((item, i) => (
                      <div key={item} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${i === 2 ? "bg-purple-500/20 text-purple-300" : "text-white/40"}`}>
                        <div className="w-3 h-3 rounded bg-current opacity-50" />
                        {item}
                      </div>
                    ))}
                  </div>
                  {/* Main content preview */}
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {["42 Docs", "38 Indexed", "1.2K Chats"].map((stat) => (
                        <div key={stat} className="glass-card p-3 text-center">
                          <div className="text-lg font-bold gradient-text">{stat.split(" ")[0]}</div>
                          <div className="text-[10px] text-white/40">{stat.split(" ")[1]}</div>
                        </div>
                      ))}
                    </div>
                    {/* Chat preview */}
                    <div className="glass-card p-3 space-y-2">
                      <div className="flex justify-end">
                        <div className="bg-purple-600/50 rounded-xl px-3 py-1.5 text-xs text-white max-w-[60%]">
                          What is the main finding in Q3 report?
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex-shrink-0" />
                        <div className="glass-card rounded-xl px-3 py-1.5 text-xs text-white/80 max-w-[70%]">
                          Based on page 4 of Q3_Report.pdf, revenue increased 23% YoY...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  variants={itemVariants}
                  className="text-center"
                >
                  <div className="flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-3xl font-black gradient-text mb-1">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 mb-4 text-sm text-purple-300 font-medium">
              <Zap className="w-4 h-4" />
              Everything you need
            </div>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              The Complete{" "}
              <span className="gradient-text">Document Intelligence</span>
              <br />
              Platform
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              From raw files to actionable insights — DocMind AI handles every step
              with state-of-the-art AI.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className="glass-card-hover p-6 group"
                  style={{
                    "--glow": feature.glow,
                  } as React.CSSProperties}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              How{" "}
              <span className="gradient-text">DocMind AI</span>
              {" "}Works
            </h2>
            <p className="text-lg text-white/50">From upload to insight in 5 steps</p>
          </motion.div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 opacity-30" />
            
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8"
            >
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    variants={itemVariants}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="relative mb-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold text-white/60">
                        {i + 1}
                      </div>
                    </div>
                    <h3 className="font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-xs text-white/50 leading-relaxed">{step.description}</p>
                    {i < steps.length - 1 && (
                      <ChevronRight className="lg:hidden w-5 h-5 text-white/20 mt-4 mx-auto rotate-90 sm:rotate-0" />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              Ready to Transform Your{" "}
              <span className="gradient-text">Documents?</span>
            </h2>
            <p className="text-lg text-white/50 mb-10">
              Join thousands of teams using DocMind AI to extract intelligence from their documents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                onClick={() => router.push("/signup")}
                whileHover={{ scale: 1.04, boxShadow: "0 25px 50px rgba(124, 58, 237, 0.5)" }}
                whileTap={{ scale: 0.96 }}
                className="btn-gradient px-10 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 relative z-10 cursor-pointer"
              >
                Start For Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="DocMind AI Logo"
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span className="font-bold gradient-text">DocMind AI</span>
          </div>
          <p className="text-sm text-white/30">
            © 2024 DocMind AI. All rights reserved. Powered by GPT-4 & Advanced OCR.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <span className="hover:text-white transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-white transition-colors cursor-pointer">Docs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
