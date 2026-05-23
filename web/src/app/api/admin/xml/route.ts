import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { loadFormConfig } from "@/lib/formConfig";
import { generateTeiXml, buildFilename } from "@/lib/xmlBuilder";
import type { FormSubmissionData } from "@/types/form";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me-in-production";

export async function POST(request: Request) {
  // ── 1. Check admin session ──
  const session = await getIronSession<{ isAdmin: boolean }>(
    await cookies(),
    {
      cookieName: "admin-session",
      password: COOKIE_SECRET,
      ttl: 60 * 60 * 8, // 8 hours
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  );

  if (!session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse JSON body ──
  let data: FormSubmissionData;
  try {
    const body = await request.json();
    data = body as FormSubmissionData;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!data || !data.charter_type || !data.fields) {
    return NextResponse.json(
      { error: "Missing required fields: charter_type and fields" },
      { status: 400 },
    );
  }

  try {
    // ── 3. Load form config ──
    const config = loadFormConfig();

    // ── 4. Generate TEI XML ──
    const xml = generateTeiXml(data, config);
    const filename = buildFilename(data);

    // ── 5. Commit to GitHub via Octokit ──
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Server configuration error: GITHUB_TOKEN not set" },
        { status: 500 },
      );
    }

    const repoEnv = process.env.GITHUB_REPO;
    if (!repoEnv) {
      return NextResponse.json(
        { error: "Server configuration error: GITHUB_REPO not set" },
        { status: 500 },
      );
    }

    const [owner, repo] = repoEnv.split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        {
          error:
            "Server configuration error: GITHUB_REPO must be in owner/repo format",
        },
        { status: 500 },
      );
    }

    const octokit = new Octokit({ auth: token });
    const branch = process.env.GITHUB_BRANCH || "main";
    const content = Buffer.from(xml).toString("base64");

    try {
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `data/tei-samples/${filename}`,
        message: `Add ${data.charter_type} charter document`,
        content,
        branch,
      });
    } catch (githubError: unknown) {
      const status =
        typeof githubError === "object" &&
        githubError !== null &&
        "status" in githubError
          ? (githubError as { status: number }).status
          : 0;

      // GitHub returns 422 when the file already exists
      if (status === 422) {
        return NextResponse.json(
          { error: "A document with this filename already exists" },
          { status: 409 },
        );
      }

      const message =
        typeof githubError === "object" &&
        githubError !== null &&
        "message" in githubError
          ? String((githubError as { message: string }).message)
          : "Unknown GitHub API error";

      return NextResponse.json(
        { error: `Failed to save document: ${message}` },
        { status: 500 },
      );
    }

    // ── 6. Return success ──
    return NextResponse.json({ success: true, filename }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate document: ${message}` },
      { status: 500 },
    );
  }
}
