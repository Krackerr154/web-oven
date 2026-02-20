import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @ts-expect-error NextConfig does have eslint property but type might be outdated
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
