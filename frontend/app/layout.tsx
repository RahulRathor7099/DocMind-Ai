import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocMind AI — Intelligent Document Processing",
  description:
    "Transform any document into actionable intelligence with AI-powered OCR, classification, and conversational search.",
  keywords: ["document AI", "OCR", "document processing", "AI chat", "vector search"],
  authors: [{ name: "DocMind AI" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "DocMind AI",
    description: "Turn any document into intelligence",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-black text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
