"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AnalyticsData, DocumentStatus } from "@/lib/types";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  FileText,
  CheckCircle,
  Database,
  MessageSquare,
  Clock,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, getFileTypeFromMime } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const data = await api.analytics.getDashboard();
      setAnalytics(data);
    } catch {
      setError("Failed to load analytics");
      // Use mock data for display
      setAnalytics({
        totalDocuments: 0,
        processedDocuments: 0,
        totalEmbeddings: 0,
        chatSessions: 0,
        processingSuccessRate: 0,
        documentsByType: [],
        recentDocuments: [],
        recentChatSessions: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getStatusColor = (status: DocumentStatus) => {
    const colors: Record<string, string> = {
      [DocumentStatus.INDEXED]: "badge-indexed",
      [DocumentStatus.ERROR]: "badge-error",
      [DocumentStatus.UPLOADING]: "badge-uploading",
    };
    return colors[status] || "badge-processing";
  };

  const getStatusLabel = (status: DocumentStatus) => {
    const labels: Record<string, string> = {
      [DocumentStatus.INDEXED]: "Indexed",
      [DocumentStatus.PARSING]: "Parsing",
      [DocumentStatus.OCR_PROCESSING]: "OCR",
      [DocumentStatus.CLASSIFYING]: "Classifying",
      [DocumentStatus.CREATING_EMBEDDINGS]: "Embedding",
      [DocumentStatus.ERROR]: "Error",
      [DocumentStatus.UPLOADING]: "Uploading",
    };
    return labels[status] || status;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">
            {greeting()},{" "}
            <span className="gradient-text">{user?.name?.split(" ")[0] || "there"} 👋</span>
          </h1>
          <p className="text-white/50 mt-1">
            Here's what's happening with your documents today.
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="p-2 rounded-xl glass-card border border-white/5 text-white/40 hover:text-white hover:border-purple-500/30 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"
      >
        <motion.div variants={itemVariants}>
          <StatCard
            title="Total Documents"
            value={analytics?.totalDocuments || 0}
            icon={FileText}
            color="from-purple-600 to-violet-600"
            glowColor="rgba(124, 58, 237, 0.3)"
            trend={analytics && analytics.totalDocuments > 0 ? { value: 12, isPositive: true } : undefined}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Indexed Documents"
            value={analytics?.processedDocuments || 0}
            icon={CheckCircle}
            color="from-green-600 to-emerald-600"
            glowColor="rgba(16, 185, 129, 0.3)"
            trend={analytics && analytics.processedDocuments > 0 ? { value: 8, isPositive: true } : undefined}
            delay={0.1}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Vector Embeddings"
            value={analytics?.totalEmbeddings || 0}
            icon={Database}
            color="from-blue-600 to-cyan-600"
            glowColor="rgba(37, 99, 235, 0.3)"
            delay={0.2}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Chat Sessions"
            value={analytics?.chatSessions || 0}
            icon={MessageSquare}
            color="from-pink-600 to-rose-600"
            glowColor="rgba(236, 72, 153, 0.3)"
            trend={analytics && analytics.chatSessions > 0 ? { value: 23, isPositive: true } : undefined}
            delay={0.3}
          />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Processing Success Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white">Processing Rate</h3>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Success Rate</span>
                <span className="font-bold text-white">
                  {analytics?.processingSuccessRate?.toFixed(1) || 0}%
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full progress-gradient rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${analytics?.processingSuccessRate || 0}%` }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Document types */}
            <div className="space-y-2 mt-4">
              {analytics?.documentsByType?.length ? (
                analytics.documentsByType.slice(0, 4).map((dtype, i) => (
                  <div key={dtype.type} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dtype.color }}
                    />
                    <span className="text-xs text-white/60 flex-1">{dtype.type}</span>
                    <span className="text-xs font-medium text-white">{dtype.count}</span>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: dtype.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(dtype.count / (analytics?.totalDocuments || 1)) * 100}%`,
                        }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/30 text-center py-4">No documents yet</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card p-6 border border-white/5"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white">Recent Documents</h3>
            <Link
              href="/documents"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {analytics?.recentDocuments?.length ? (
              analytics.recentDocuments.slice(0, 5).map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                >
                  <Link href={`/documents/${doc.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                          {doc.originalFilename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-white/30" />
                          <span className="text-xs text-white/40">
                            {formatRelativeTime(doc.uploadedAt)}
                          </span>
                          <span className="text-xs text-white/30">•</span>
                          <span className="text-xs text-white/40">
                            {doc.pageCount} pages
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(doc.status)}`}
                      >
                        {getStatusLabel(doc.status)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10">
                <FileText className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30">No documents yet</p>
                <Link href="/upload">
                  <button className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    Upload your first document →
                  </button>
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Chat Sessions */}
      {analytics?.recentChatSessions && analytics.recentChatSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 border border-white/5"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white">Recent Chat Sessions</h3>
            <Link
              href="/chat"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.recentChatSessions.slice(0, 6).map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link href={`/chat/${session.id}`}>
                  <div className="p-4 rounded-xl bg-white/3 hover:bg-white/8 border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/40 to-blue-600/40 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                          {session.title}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5 truncate">
                          {session.lastMessage}
                        </p>
                        <p className="text-xs text-white/30 mt-1">
                          {formatRelativeTime(session.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
