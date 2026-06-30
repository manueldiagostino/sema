import { NextResponse } from "next/server";
import {
  getGitHubToken,
  publishChanges,
  getAheadCount,
  getGitStatus,
} from "@/lib/git";

export async function POST() {
  try {
    const root = process.cwd();

    // 1. Verify token is configured
    const token = getGitHubToken(root);
    if (!token) {
      return NextResponse.json(
        {
          error:
            "GitHub token not configured. Add the token via the publish interface.",
          tokenConfigured: false,
        },
        { status: 401 },
      );
    }

    // 2. Check there's something to publish (uncommitted changes OR unpushed commits)
    const currentFiles = getGitStatus(root);
    const aheadCount = getAheadCount(root);
    if (currentFiles.length === 0 && aheadCount === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No changes to publish",
        },
        { status: 200 },
      );
    }

    // 3. Execute publish
    const result = publishChanges(root);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 409 },
      );
    }

    console.log(
      `[publish] Published: ${result.commitHash} — ${result.files?.length ?? 0} files`,
    );

    return NextResponse.json(
      {
        success: true,
        commitHash: result.commitHash,
        commitMessage: result.commitMessage,
        files: result.files,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[publish] Failed to publish:", error);
    return NextResponse.json(
      { error: `Publish failed: ${message}` },
      { status: 500 },
    );
  }
}
