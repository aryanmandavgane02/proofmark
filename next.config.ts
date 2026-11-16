import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every Proofmark page is private to the visitor's workspace and reads their session cookie,
  // so pages render per request. Cache Components (prerendered shells) would add little here.
  cacheComponents: false,
  partialPrefetching: false,
  serverExternalPackages: ["sharp"],
  experimental: {
    // Draft images up to 4 MB (Vercel accepts request bodies up to 4.5 MB).
    serverActions: { bodySizeLimit: "4.4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
