"use client";

import { useState } from "react";

interface DeleteConfirmModalProps {
  filename: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteConfirmModal({
  filename,
  isOpen,
  onClose,
  onDeleted,
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/xml?filename=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        onDeleted();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete document.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-modal-title"
          className="text-lg font-semibold text-foreground"
        >
          Delete Document
        </h2>

        <p className="mt-3 text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-mono font-medium text-foreground">{filename}</span>
          ? This action cannot be undone.
        </p>

        {error && (
          <div
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
            role="alert"
          >
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
