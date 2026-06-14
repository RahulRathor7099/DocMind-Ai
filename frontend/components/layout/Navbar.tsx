"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  Search,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Brain,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Welcome to DocMind AI",
      description: "Start uploading documents to chat with them.",
      time: "Just now",
      unread: true,
    },
    {
      id: "2",
      title: "Sample PDF Processed",
      description: "The demo document was parsed and indexed successfully.",
      time: "10 mins ago",
      unread: true,
    },
    {
      id: "3",
      title: "Hyperparameters Updated",
      description: "Chunk extraction size saved successfully in settings.",
      time: "1 hour ago",
      unread: false,
    },
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const pageTitle = {
    "/dashboard": "Dashboard",
    "/upload": "Upload Documents",
    "/documents": "Document Library",
    "/chat": "AI Chat",
    "/settings": "Settings",
  }[pathname.split("/").slice(0, 3).join("/") as string] || "DocMind AI";

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
  };

  return (
    <header className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-xl flex items-center px-4 gap-4 z-30 sticky top-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Logo */}
      <div
        onClick={() => router.push("/dashboard")}
        className="lg:hidden flex items-center gap-2 cursor-pointer"
      >
        <img
          src="/logo.png"
          alt="DocMind AI Logo"
          className="w-7 h-7 rounded-lg object-cover"
        />
        <span className="font-bold text-sm gradient-text">DocMind AI</span>
      </div>

      {/* Page title (desktop) */}
      <div className="hidden lg:block">
        <h1 className="text-lg font-semibold text-white/90">{pageTitle}</h1>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
        >
          <Search className="w-5 h-5" />
        </button>
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="absolute right-0 top-12 w-72 glass-card p-3 z-50"
            >
              <input
                autoFocus
                type="text"
                placeholder="Search documents..."
                className="w-full input-dark px-3 py-2 text-sm"
                onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => {
            setIsNotificationsOpen(!isNotificationsOpen);
            setIsSearchOpen(false);
            setIsDropdownOpen(false);
          }}
          className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full" />
          )}
        </button>

        <AnimatePresence>
          {isNotificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsNotificationsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 glass-card p-4 border border-white/10 rounded-2xl z-30 shadow-2xl bg-[#09090d] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-white">Notifications</span>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-semibold text-purple-400 hover:text-purple-300"
                      >
                        Read All
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearNotifications}
                        className="text-[10px] font-semibold text-white/40 hover:text-white/60"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-white/30">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((item) =>
                              item.id === n.id ? { ...item, unread: false } : item
                            )
                          );
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left space-y-1 ${
                          n.unread
                            ? "bg-purple-500/5 border-purple-500/20 text-white"
                            : "bg-transparent border-transparent text-white/50 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold truncate flex-1">{n.title}</span>
                          {n.unread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[10px] text-white/40 leading-relaxed">
                          {n.description}
                        </p>
                        <span className="text-[9px] text-white/30 block font-mono">
                          {n.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User avatar dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-sm text-white/80 hidden sm:block max-w-[100px] truncate">
            {user?.name || "User"}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-white/40 transition-transform",
              isDropdownOpen && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 w-52 glass-card py-2 z-50 shadow-glow-purple"
            >
              <div className="px-4 py-2 border-b border-white/5">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { router.push("/settings"); setIsDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => { router.push("/settings"); setIsDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
              <div className="border-t border-white/5 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
