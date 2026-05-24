import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Next.js the project root is web/, not the repo root
  turbopack: {
    root: path.resolve(__dirname),
  } as NextConfig["turbopack"],
};

export default nextConfig;
