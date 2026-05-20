import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  // GitHub Pages project page: username.github.io/sema/
  // Change "/sema" to match your repo name if different
  basePath: "/sema",
  assetPrefix: "/sema",
};

export default nextConfig;
