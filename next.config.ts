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
      env: {
        NEXT_PUBLIC_BASE_PATH: `/${repoName}`,
      },
    }
  : {
      env: {
        NEXT_PUBLIC_BASE_PATH: "",
      },
    };

export default nextConfig;
