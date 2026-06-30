import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { getActiveTeiDir } from "./dataDir";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted";
}

export interface GitStatus {
  hasChanges: boolean;
  files: GitFile[];
  branch: string;
  lastCommit: {
    hash: string;
    message: string;
    date: string;
    author: string;
  } | null;
  tokenConfigured: boolean;
  /** Number of commits ahead of origin/main (unpushed) */
  aheadCount: number;
}

export interface PublishResult {
  success: boolean;
  commitHash?: string;
  commitMessage?: string;
  files?: GitFile[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Paths (relative to project root = process.cwd())
// ---------------------------------------------------------------------------

const TOKEN_FILE = "data/.github-token";
const CORPUS_PATHS = ["data/corpus/", "data/fake/"];

// ---------------------------------------------------------------------------
// Git command runner (execFileSync — no shell, no injection risk)
// ---------------------------------------------------------------------------

const tokenFilePath = (root: string) => join(root, TOKEN_FILE);

function git(args: string[], root: string): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf-8",
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}



// ---------------------------------------------------------------------------
// getGitStatus
// ---------------------------------------------------------------------------

/**
 * Runs `git status --porcelain` and returns only files under
 * `data/corpus/`.
 */
export function getGitStatus(root: string): GitFile[] {
  const raw = git(["status", "--porcelain"], root);

  if (!raw) return [];

  const files: GitFile[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;

    // Parse porcelain format: XY<space><path> where XY is exactly 2 chars
    //   Staged:    "M  path"   (X=M, Y=space, separator space, path)
    //   Unstaged:  " M path"   (X=space, Y=M, separator space, path)
    //   Untracked: "?? path"   (X=?, Y=?, separator space, path)
    //
    // The git() helper applies .trim() which strips the leading space
    // from unstaged entries (" M path" → "M path"), shifting indexes.
    // Handle both trimmed and untrimmed porcelain output robustly.

    let xy: string;
    let filePath: string;

    if (line.length > 2 && line[2] === " ") {
      // Standard/untrimmed format: XY is at [0,2), path at [3,)
      xy = line.slice(0, 2);
      filePath = line.slice(3);
    } else if (line.length > 1 && line[1] === " ") {
      // Trimmed unstaged output: "M path" → reconstruct XY as " M"
      xy = " " + line[0];
      filePath = line.slice(2);
    } else {
      continue; // malformed line
    }

    // Only include corpus-related paths
    const isRelevant = CORPUS_PATHS.some((p) => filePath.startsWith(p));
    if (!isRelevant) continue;

    let status: GitFile["status"];
    if (xy.startsWith("A") || xy.startsWith("?") || xy.startsWith("C")) {
      status = "added";
    } else if (xy.startsWith("D")) {
      status = "deleted";
    } else {
      status = "modified";
    }

    files.push({ path: filePath, status });
  }

  return files;
}

// ---------------------------------------------------------------------------
// getLastCommit
// ---------------------------------------------------------------------------

export function getLastCommit(root: string): GitStatus["lastCommit"] {
  try {
    const raw = git(
      ["log", "-1", "--format=%H%n%s%n%ci%n%an", "--"],
      root,
    );
    if (!raw) return null;
    const [hash, message, date, author] = raw.split("\n");
    return {
      hash: hash?.slice(0, 7) ?? "",
      message: message ?? "",
      date: date ?? "",
      author: author ?? "",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getCurrentBranch
// ---------------------------------------------------------------------------

export function getCurrentBranch(root: string): string {
  try {
    return git(["rev-parse", "--abbrev-ref", "HEAD"], root);
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// getAheadCount
// ---------------------------------------------------------------------------

/**
 * Returns the number of commits ahead of origin/main (unpushed commits).
 * Returns 0 if there's no remote or the branch has no upstream.
 */
export function getAheadCount(root: string): number {
  try {
    const raw = git(["rev-list", "--count", "HEAD", "^origin/main"], root);
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

export function getGitHubToken(root: string): string | null {
  const fp = tokenFilePath(root);
  if (!existsSync(fp)) return null;
  const token = readFileSync(fp, "utf-8").trim();
  return token || null;
}

export function saveGitHubToken(root: string, token: string): void {
  const fp = tokenFilePath(root);
  const dir = join(root, "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(fp, token, { encoding: "utf-8", mode: 0o600 });
}

// ---------------------------------------------------------------------------
// autoCommitCorpus
// ---------------------------------------------------------------------------

export interface AutoCommitResult {
  committed: boolean;
  error?: string;
}

/**
 * Stages all changes in the active TEI directory and commits with an
 * auto-save message. Uses `git add -A` so that additions, modifications,
 * and deletions are all captured.
 *
 * Checks git availability and change presence first, so it never attempts
 * a commit when there's nothing to stage — no locale-dependent string
 * matching against git output.
 *
 * @param root - Project root directory (process.cwd())
 * @param detail - Short description for the commit message (e.g. filename + mode)
 */
export function autoCommitCorpus(root: string, detail: string): AutoCommitResult {
  // 1. Check git availability
  try {
    git(["--version"], root);
  } catch {
    return { committed: false, error: "git not available" };
  }

  // 2. Determine active corpus directory (respects fake mode)
  const teiDir = getActiveTeiDir(root);
  const relPath = relative(root, teiDir);

  // 3. Stage all changes — adds, modifications, and deletions
  try {
    git(["add", "-A", "--", relPath], root);
  } catch (err) {
    return { committed: false, error: `git add failed: ${extractStderr(err)}` };
  }

  // 4. Bail out early if nothing was staged
  try {
    const staged = git(["diff", "--cached", "--name-only", "--", relPath], root);
    if (staged.length === 0) {
      return { committed: false };
    }
  } catch (err) {
    return { committed: false, error: `git diff failed: ${extractStderr(err)}` };
  }

  // 5. Commit
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const commitMsg = `Auto-save: ${detail} [${dateStr}]`;

  try {
    git(["commit", "-m", commitMsg], root);
    console.log(`[git.ts] ${commitMsg}`);
    return { committed: true };
  } catch (err) {
    return { committed: false, error: extractStderr(err) };
  }
}

/** Extract stderr from an execFileSync error, or the message as fallback. */
function extractStderr(err: unknown): string {
  if (err instanceof Error && "stderr" in err) {
    return (err as any).stderr?.toString() ?? err.message;
  }
  return String(err);
}

// ---------------------------------------------------------------------------
// publishChanges
// ---------------------------------------------------------------------------

/**
 * Stages and commits corpus files, pulls remote changes, then pushes.
 * Authentication is handled transparently by Git Credential Manager (GCM).
 */
export function publishChanges(root: string): PublishResult {
  // 1. Check for anything to publish (uncommitted changes OR unpushed commits)
  const statusFiles = getGitStatus(root);
  const aheadCount = getAheadCount(root);

  if (statusFiles.length === 0 && aheadCount === 0) {
    return { success: true, message: "No changes to publish" };
  }

  // 2. If there are uncommitted changes, stage and commit them
  if (statusFiles.length > 0) {
    // Stage corpus files only
    git(["add", "--", "data/corpus/"], root);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const commitMsg = `Corpus update [${dateStr}]`;

    try {
      git(["commit", "-m", commitMsg], root);
    } catch (err: unknown) {
      const stderr =
        err instanceof Error && "stderr" in err
          ? (err as any).stderr?.toString() ?? err.message
          : String(err);

      // "nothing to commit" is harmless — files may have been filtered out
      if (!stderr.includes("nothing to commit")) {
        return {
          success: false,
          message: `Commit failed: ${stderr}`,
        };
      }
    }
  }

  // 3. Pull remote changes (GCM handles authentication)
  try {
    git(["pull", "--rebase", "origin", "main"], root);
  } catch {
    // Rebase failed — abort, reset staging, and report
    try { git(["rebase", "--abort"], root); } catch { /* ignore */ }
    try { git(["reset", "HEAD"], root); } catch { /* ignore */ }
    return {
      success: false,
      message:
        "Conflict: the remote repository has conflicting changes. Resolve manually before publishing.",
    };
  }

  // 4. Push (GCM handles authentication)
  try {
    git(["push", "origin", "main"], root);
  } catch {
    return {
      success: false,
      message:
        "Push failed. Verify you have write permissions and Git Credential Manager is configured.",
    };
  }

  // 5. Success
  const commitHash = git(["rev-parse", "--short", "HEAD"], root);
  console.log(`[git.ts] Published commit ${commitHash}: ${statusFiles.length} files`);

  return {
    success: true,
    commitHash,
    commitMessage: "Corpus update",
    files: statusFiles.length > 0 ? statusFiles : undefined,
  };
}
