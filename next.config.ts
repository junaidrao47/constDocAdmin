import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // Emit a self-contained server bundle (.next/standalone) for a lean production
  // Docker image that ships only the traced runtime deps. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
