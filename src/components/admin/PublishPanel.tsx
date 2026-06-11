"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted";
}

interface GitStatus {
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
}

interface PublishResponse {
  success: boolean;
  commitHash?: string;
  commitMessage?: string;
  files?: GitFile[];
  message?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "new";
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "added":
      return "text-primary";
    case "modified":
      return "text-secondary";
    case "deleted":
      return "text-accent";
    default:
      return "text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// PublishPanel
// ---------------------------------------------------------------------------

export default function PublishPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null);

  // Token modal state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Confirm dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch status
  // -----------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/publish/status");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      const data: GitStatus = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // -----------------------------------------------------------------------
  // Publish flow
  // -----------------------------------------------------------------------

  const handlePublishClick = () => {
    if (status && !status.tokenConfigured) {
      setShowTokenModal(true);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirmPublish = async () => {
    setShowConfirm(false);
    setPublishing(true);
    setPublishResult(null);

    try {
      const res = await fetch("/api/admin/publish", { method: "POST" });
      const data: PublishResponse = await res.json();
      setPublishResult(data);

      if (data.success) {
        // Refresh status after successful publish
        setTimeout(fetchStatus, 1000);
      }
    } catch (err) {
      setPublishResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setPublishing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Token save flow
  // -----------------------------------------------------------------------

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setTokenError("Please enter a valid token");
      return;
    }

    setTokenSaving(true);
    setTokenError(null);

    try {
      const res = await fetch("/api/admin/publish/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error saving token");
      }

      setShowTokenModal(false);
      setTokenInput("");

      // Refresh status (tokenConfigured will now be true)
      await fetchStatus();

      // Proceed to confirmation dialog
      setShowConfirm(true);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTokenSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Count files by status
  // -----------------------------------------------------------------------

  const fileCounts = status
    ? {
        added: status.files.filter((f) => f.status === "added").length,
        modified: status.files.filter((f) => f.status === "modified").length,
        deleted: status.files.filter((f) => f.status === "deleted").length,
      }
    : null;

  const totalChanges = fileCounts
    ? fileCounts.added + fileCounts.modified + fileCounts.deleted
    : 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Publish to GitHub
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Makes changes available on the public site
        </p>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            Loading status...
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3">
            <p className="text-sm text-accent">{error}</p>
            <button
              type="button"
              onClick={fetchStatus}
              className="mt-2 text-sm font-medium text-accent hover:text-accent/70"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status display */}
        {!loading && !error && status && (
          <div className="space-y-4">
            {/* Token status */}
            {!status.tokenConfigured && (
              <div className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3">
                <p className="text-sm text-accent">
                  <span className="font-medium">GitHub token not configured.</span>{" "}
                  A token is required to publish to GitHub.
                </p>
              </div>
            )}

            {/* Last commit info */}
            {status.lastCommit && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Last commit:</span>{" "}
                {status.lastCommit.message}{" "}
                <span className="text-muted-foreground">
                  ({status.lastCommit.hash},{" "}
                  {formatDate(status.lastCommit.date)})
                </span>
              </div>
            )}

            {/* Branch */}
            {status.branch && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Branch:</span>{" "}
                {status.branch}
              </div>
            )}

            {/* File changes summary */}
            {totalChanges > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Pending changes ({totalChanges} file{totalChanges !== 1 ? "s" : ""}):
                </p>
                <div className="flex flex-wrap gap-3">
                  {(["added", "modified", "deleted"] as const).map(
                    (type) =>
                      (fileCounts?.[type] ?? 0) > 0 && (
                        <span
                          key={type}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            type === "added"
                              ? "bg-primary-container text-primary-on-container"
                              : type === "modified"
                                ? "bg-muted text-secondary"
                                : "bg-muted text-accent"
                          }`}
                        >
                          {fileCounts?.[type]} {statusLabel(type)}
                        </span>
                      ),
                  )}
                </div>
                {/* File list (truncated) */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Show files
                  </summary>
                  <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {status.files.map((f) => (
                      <li key={f.path} className={statusColor(f.status)}>
                        [{f.status}] {f.path}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ) : (
              <div className="rounded-md bg-muted px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  All up to date &mdash; no changes to publish.
                </p>
              </div>
            )}

            {/* Publish button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={totalChanges === 0 || publishing}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing
                  ? "Publishing..."
                  : totalChanges === 0
                    ? "Publish"
                    : "Publish to GitHub"}
              </button>

              <button
                type="button"
                onClick={fetchStatus}
                disabled={publishing}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {/* Publish result */}
            {publishResult && (
              <div
                className={`rounded-md border px-4 py-3 ${
                  publishResult.success
                    ? "border-primary/30 bg-primary-container"
                    : "border-accent/30 bg-accent/10"
                }`}
              >
                {publishResult.success ? (
                  <div>
                    <p className="text-sm font-medium text-primary-on-container">
                      {publishResult.message ?? "Publish completed!"}
                    </p>
                    {publishResult.commitHash && (
                      <p className="mt-1 text-xs text-primary-on-container">
                        Commit: {publishResult.commitHash}
                        {publishResult.commitMessage &&
                          ` — ${publishResult.commitMessage}`}
                      </p>
                    )}
                    {publishResult.files && (
                      <p className="mt-1 text-xs text-primary-on-container">
                        {publishResult.files.length} file{publishResult.files.length !== 1 ? "s" : ""} published
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-accent">
                      Publish failed
                    </p>
                    <p className="mt-1 text-sm text-accent">
                      {publishResult.error ?? publishResult.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Token setup modal ── */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Configure GitHub token
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              To publish to GitHub you need a Personal Access Token with write
              permissions on the repository.
            </p>

            <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:text-accent"
                >
                  GitHub &rarr; Settings &rarr; Tokens
                </a>
              </li>
              <li>Create a Fine-grained token with access to the sema repository</li>
              <li>Select the <strong>Contents: Write</strong> permission</li>
              <li>Copy the token and paste it below</li>
            </ol>

            <div className="mt-4">
              <label
                htmlFor="github-token"
                className="block text-sm font-medium text-foreground"
              >
                GitHub Personal Access Token
              </label>
              <input
                id="github-token"
                type="password"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setTokenError(null);
                }}
                placeholder="ghp_..."
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
              {tokenError && (
                <p className="mt-1 text-sm text-accent">{tokenError}</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTokenModal(false);
                  setTokenInput("");
                  setTokenError(null);
                }}
                disabled={tokenSaving}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={tokenSaving || !tokenInput.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tokenSaving ? "Saving..." : "Save & publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Confirm publish
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You are about to publish{" "}
              <strong>{totalChanges} file{totalChanges !== 1 ? "s" : ""}</strong> to GitHub.
              {status?.branch && (
                <>
                  {" "}Branch: <strong>{status.branch}</strong>.
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This will commit and push. Continue?
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPublish}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              >
                Confirm &amp; publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
