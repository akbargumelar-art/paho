import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth"],
  // Fix: Next.js salah deteksi workspace root karena ada package-lock.json di /root/
  // Explicitly set ke direktori project ini (/root/paho)
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
