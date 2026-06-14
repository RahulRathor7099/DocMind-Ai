import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(dateString);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function getFileTypeFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPG",
    "text/plain": "TXT",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
  };
  return map[mimeType] || "FILE";
}

export function getFileTypeColor(type: string): string {
  const colors: Record<string, string> = {
    PDF: "text-red-400 bg-red-400/10 border-red-400/20",
    PNG: "text-green-400 bg-green-400/10 border-green-400/20",
    JPEG: "text-green-400 bg-green-400/10 border-green-400/20",
    JPG: "text-green-400 bg-green-400/10 border-green-400/20",
    TXT: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    DOCX: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    DOC: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  };
  return colors[type] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
