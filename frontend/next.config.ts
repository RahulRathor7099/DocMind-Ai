import type { NextConfig } from "next";

const getBackendConfig = () => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const parsed = new URL(url);
    return {
      url,
      hostname: parsed.hostname,
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
    };
  } catch (e) {
    return {
      url: "http://localhost:8000",
      hostname: "localhost",
      protocol: "http" as const,
      port: "8000",
    };
  }
};

const backend = getBackendConfig();

const nextConfig: NextConfig = {
  images: {
    domains: [backend.hostname, "localhost"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: backend.protocol,
        hostname: backend.hostname,
        port: backend.port,
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend.url}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backend.url}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
