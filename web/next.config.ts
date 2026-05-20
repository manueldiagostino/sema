import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  // GitHub Pages project page: username.github.io/sema/
  // Only applied in production (npm run build), skipped in dev (npm run dev)
  ...(process.env.NODE_ENV === "production"
    ? { basePath: "/sema", assetPrefix: "/sema" }
    : {}),
};

export default nextConfig;
