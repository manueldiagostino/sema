import { NextResponse } from "next/server";
import {
  getGitStatus,
  getLastCommit,
  getCurrentBranch,
  getGitHubToken,
  getAheadCount,
  type GitStatus,
} from "@/lib/git";

export async function GET() {
  try {
    const root = process.cwd();
    const files = getGitStatus(root);
    const lastCommit = getLastCommit(root);
    const branch = getCurrentBranch(root);
    const tokenConfigured = getGitHubToken(root) !== null;
    const aheadCount = getAheadCount(root);

    const response: GitStatus = {
      hasChanges: files.length > 0 || aheadCount > 0,
      files,
      branch,
      lastCommit,
      tokenConfigured,
      aheadCount,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[publish/status] Failed to get git status:", error);
    return NextResponse.json(
      { error: `Unable to read git status: ${message}` },
      { status: 500 },
    );
  }
}
