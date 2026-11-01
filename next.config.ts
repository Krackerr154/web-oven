import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output in production to prevent Turbopack panics in dev mode
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default nextConfig;
