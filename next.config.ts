import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow mobile testing on local network
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.0.103:3000"]
    }
  },
  // If NextJS >= 15+ blocking cross-origin dev chunks:
  serverExternalPackages: [],
} as NextConfig & { allowedDevOrigins?: string[] };

nextConfig.allowedDevOrigins = ['192.168.0.103'];

export default nextConfig;
