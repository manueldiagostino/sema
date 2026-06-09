import { NextResponse } from "next/server";
import { saveGitHubToken } from "@/lib/git";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: "Token required" },
        { status: 400 },
      );
    }

    const root = process.cwd();
    saveGitHubToken(root, token.trim());

    console.log("[publish/token] GitHub token saved");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[publish/token] Failed to save token:", error);
    return NextResponse.json(
      { error: `Unable to save token: ${message}` },
      { status: 500 },
    );
  }
}
