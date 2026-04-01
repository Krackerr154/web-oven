import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output in production to prevent Turbopack panics in dev mode
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  // @ts-expect-error NextConfig does have eslint property but type might be outdated
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
