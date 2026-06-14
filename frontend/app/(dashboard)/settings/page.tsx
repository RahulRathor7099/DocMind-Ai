"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  User,
  Settings,
  Shield,
  Database,
  Cpu,
  Sparkles,
  Check,
  Eye,
  Lock,
  Activity,
  HardDrive,
  RefreshCw,
  Clock,
  Radio,
  FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface SystemSettings {
  llmProvider: "gemini" | "groq" | "openai";
  chunkSize: number;
  chunkOverlap: number;
  enableGlow: boolean;
  theme: "default" | "amoled";
  voiceSensitivity: "normal" | "high";
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "agent" | "ui" | "diagnostics">("account");
  
  // Profile settings state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState<SystemSettings>({
    llmProvider: "gemini",
    chunkSize: 1000,
    chunkOverlap: 200,
    enableGlow: true,
    theme: "default",
    voiceSensitivity: "normal",
  });

  // Diagnostics state
  const [pingStatus, setPingStatus] = useState<"checking" | "online" | "offline">("checking");
  const [dbStats, setDbStats] = useState<{ docs: number; embeddings: number } | null>(null);
  const [isRefreshingDiagnostics, setIsRefreshingDiagnostics] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("docmind_settings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    checkDiagnostics();
  }, []);

  const handleSaveProfile = async () => {
    if (!username.trim() || !email.trim()) {
      toast({
        title: "Validation Error",
        description: "Username and email cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUpdatingProfile(true);
    try {
      const updatedUser = await api.auth.updateProfile({
        name: username,
        email: email,
      });
      
      // Update state & store
      setUser(updatedUser);
      
      // Update localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("docmind_user", JSON.stringify(updatedUser));
      }
      
      toast({
        title: "Profile Updated",
        description: "Your account credentials have been successfully updated.",
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to update profile";
      toast({
        title: "Update Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const checkDiagnostics = async () => {
    setPingStatus("checking");
    setIsRefreshingDiagnostics(true);
    try {
      const start = Date.now();
      const analytics = await api.analytics.getDashboard();
      const end = Date.now();
      
      setPingStatus("online");
      setDbStats({
        docs: analytics.totalDocuments,
        embeddings: analytics.totalEmbeddings,
      });
      toast({
        title: "Connection healthy",
        description: `Backend ping resolved in ${end - start}ms.`,
      });
    } catch (err) {
      setPingStatus("offline");
      toast({
        title: "Backend offline",
        description: "Could not establish a connection to the FastAPI server.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingDiagnostics(false);
    }
  };

  const handleSaveSettings = (updates: Partial<SystemSettings>) => {
    const updatedSettings = { ...settings, ...updates };
    setSettings(updatedSettings);
    localStorage.setItem("docmind_settings", JSON.stringify(updatedSettings));
    toast({
      title: "Settings Saved",
      description: "Your configurations have been successfully updated.",
    });
  };

  const tabs = [
    { id: "account", label: "Profile Info", icon: User },
    { id: "agent", label: "Agentic RAG Settings", icon: Cpu },
    { id: "ui", label: "Interface & UI", icon: Eye },
    { id: "diagnostics", label: "System Diagnostics", icon: Activity },
  ] as const;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl lg:text-3xl font-black text-white">System Settings</h1>
        <p className="text-white/50 mt-1">
          Customize your profile, RAG agent hyperparameters, and monitor overall health status
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex md:flex-col gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto md:overflow-x-visible shrink-0"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all text-left ${
                activeTab === id
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                  : "text-white/40 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </motion.div>

        {/* Tab Viewport */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-6 border border-white/5 space-y-6"
              >
                <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-purple-500/10">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{user?.name || "Active User"}</h3>
                    <p className="text-sm text-purple-300">Registered Account</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/5 focus:border-purple-500/30 focus:bg-white/[0.04] text-sm text-white/80 focus:outline-none transition-all"
                      placeholder="Username"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/5 focus:border-purple-500/30 focus:bg-white/[0.04] text-sm text-white/80 focus:outline-none transition-all"
                      placeholder="Email Address"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile || (username === user?.name && email === user?.email)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg shadow-purple-600/10 transition-all"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Secure Session Active</span>
                    Your session is authorized using a secure JSON Web Token (JWT) expiring automatically in 24 hours.
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "agent" && (
              <motion.div
                key="agent"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-6 border border-white/5 space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-purple-400" />
                    RAG Hyperparameters
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Configure chunking metrics and preferred inference engines</p>
                </div>

                <div className="space-y-5">
                  {/* LLM Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Preferred Inference LLM</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "gemini", name: "Gemini 1.5 Flash", provider: "Google" },
                        { id: "groq", name: "Llama 3 (Groq)", provider: "Meta" },
                        { id: "openai", name: "GPT-4o (OpenAI)", provider: "OpenAI" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSaveSettings({ llmProvider: item.id as any })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            settings.llmProvider === item.id
                              ? "bg-purple-500/10 border-purple-500/30 text-white"
                              : "bg-white/[0.01] border-white/5 text-white/50 hover:bg-white/[0.03] hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{item.name}</span>
                            {settings.llmProvider === item.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <span className="text-[10px] text-white/30 block mt-0.5">{item.provider}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chunk Size */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-white/50 uppercase tracking-wider">
                      <span>Chunk Extraction Size</span>
                      <span className="text-purple-300 font-mono">{settings.chunkSize} characters</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="2000"
                      step="100"
                      value={settings.chunkSize}
                      onChange={(e) => handleSaveSettings({ chunkSize: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <span className="text-[10px] text-white/30 block">Controls raw character count extracted per vector document slice.</span>
                  </div>

                  {/* Chunk Overlap */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-white/50 uppercase tracking-wider">
                      <span>Context Overlap</span>
                      <span className="text-purple-300 font-mono">{settings.chunkOverlap} characters</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="400"
                      step="50"
                      value={settings.chunkOverlap}
                      onChange={(e) => handleSaveSettings({ chunkOverlap: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <span className="text-[10px] text-white/30 block">Characters repeated between contiguous pages to maintain local syntax contexts.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "ui" && (
              <motion.div
                key="ui"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-6 border border-white/5 space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-400" />
                    Interface Customization
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Personalize how DocMind AI looks and interacts</p>
                </div>

                <div className="space-y-5">
                  {/* Theme Select */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Theme Preset</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "default", name: "Deep Tech Dark", desc: "Sleek slate accents with subtle dark gradients" },
                        { id: "amoled", name: "Amoled Black", desc: "Solid true-black canvas optimized for contrast displays" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSaveSettings({ theme: item.id as any })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            settings.theme === item.id
                              ? "bg-purple-500/10 border-purple-500/30 text-white"
                              : "bg-white/[0.01] border-white/5 text-white/50 hover:bg-white/[0.03] hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{item.name}</span>
                            {settings.theme === item.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <span className="text-[10px] text-white/30 block mt-1">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UI Glow Toggles */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <div>
                      <span className="text-xs font-bold text-white block">Glassmorphism Glow Outlines</span>
                      <span className="text-[10px] text-white/30 block mt-0.5">Render vibrant ambient neon shadows on stat cards and layouts.</span>
                    </div>
                    <button
                      onClick={() => handleSaveSettings({ enableGlow: !settings.enableGlow })}
                      className={`w-11 h-6 rounded-full transition-all relative ${
                        settings.enableGlow ? "bg-purple-600" : "bg-white/10"
                      }`}
                    >
                      <motion.div
                        className="w-4 h-4 bg-white rounded-full absolute top-1"
                        animate={{ left: settings.enableGlow ? "24px" : "4px" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  {/* Voice Sensitivity */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/5">
                    <div>
                      <span className="text-xs font-bold text-white block">Acoustic Transcription Sensitivity</span>
                      <span className="text-[10px] text-white/30 block mt-0.5">Filter ambient microphone frequency noise during voice speech recognition.</span>
                    </div>
                    <button
                      onClick={() => handleSaveSettings({ voiceSensitivity: settings.voiceSensitivity === "normal" ? "high" : "normal" })}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 hover:border-purple-500/20 text-purple-300 hover:text-white transition-all bg-white/5"
                    >
                      {settings.voiceSensitivity === "normal" ? "Normal Filter" : "High Filter"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "diagnostics" && (
              <motion.div
                key="diagnostics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="glass-card p-6 border border-white/5 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      Diagnostics Console
                    </h3>
                    <p className="text-xs text-white/40 mt-1">Verify backend connections and database health statistics</p>
                  </div>
                  <button
                    onClick={checkDiagnostics}
                    disabled={isRefreshingDiagnostics}
                    className="p-2 rounded-xl glass-card border border-white/5 text-white/40 hover:text-white hover:border-purple-500/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingDiagnostics ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Ping */}
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${pingStatus === "online" ? "text-green-400 animate-pulse" : pingStatus === "checking" ? "text-yellow-400 animate-spin" : "text-red-400"}`} />
                      <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Gateway Status</span>
                    </div>
                    <p className="text-lg font-black text-white capitalize">{pingStatus}</p>
                  </div>

                  {/* Documents Count */}
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Stored Files</span>
                    </div>
                    <p className="text-lg font-black text-white">
                      {dbStats ? dbStats.docs : "—"}
                    </p>
                  </div>

                  {/* Embeddings Count */}
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-white/50 font-bold uppercase tracking-wider">FAISS Embeddings</span>
                    </div>
                    <p className="text-lg font-black text-white">
                      {dbStats ? dbStats.embeddings.toLocaleString() : "—"}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                    <HardDrive className="w-4 h-4" />
                    <span>System Specifications</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px] text-white/40 font-mono">
                    <div>Vector Database: FAISS Local Index</div>
                    <div>Metadata DB: SQLite (docmind.db)</div>
                    <div>Embedding Dimension: 384 (all-MiniLM-L6-v2)</div>
                    <div>NLP Framework: LangChain 0.3.x Namespace</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
