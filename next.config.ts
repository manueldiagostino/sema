import type { NextConfig } from "next";

const repoName = "sema";

const isExport = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = isExport
  ? {
      output: "export",
      basePath: `/${repoName}`,
      assetPrefix: `/${repoName}/`,
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
    }
  : {};

export default nextConfig;
