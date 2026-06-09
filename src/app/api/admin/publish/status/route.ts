import { NextResponse } from "next/server";
import {
  getGitStatus,
  getLastCommit,
  getCurrentBranch,
  getGitHubToken,
  type GitStatus,
} from "@/lib/git";

export async function GET() {
  try {
    const root = process.cwd();
    const files = getGitStatus(root);
    const lastCommit = getLastCommit(root);
    const branch = getCurrentBranch(root);
    const tokenConfigured = getGitHubToken(root) !== null;

    const response: GitStatus = {
      hasChanges: files.length > 0,
      files,
      branch,
      lastCommit,
      tokenConfigured,
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
