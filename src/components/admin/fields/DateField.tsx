"use client";

import React, { useState } from "react";
import type { DateFieldValue } from "@/types/form";

interface DateFieldProps {
  value: DateFieldValue;
  onChange: (value: DateFieldValue) => void;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

/** Validate ISO date format: YYYY, YYYY-MM (01-12), or YYYY-MM-DD (real calendar date) */
function isValidIso(iso: string): boolean {
  if (!iso) return true; // empty is allowed (not a required-field check)
  const match = iso.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) : null;
  const day = match[3] ? parseInt(match[3], 10) : null;

  if (month !== null && (month < 1 || month > 12)) return false;
  if (month !== null && day !== null) {
    // Construct date and verify components match (catches Feb 30, etc.)
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false;
  }
  return true;
}

export default function DateField({
  value,
  onChange,
  disabled = false,
  id,
  required = false,
}: DateFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && !isValidIso(value.iso);

  return (
    <div className="space-y-1">
      <div className="flex gap-3">
        <input
          id={id ? `${id}-iso` : undefined}
          type="text"
          value={value.iso}
          onChange={(e) => {
            setTouched(true);
            onChange({ ...value, iso: e.target.value });
          }}
          placeholder="YYYY-MM-DD"
          disabled={disabled}
          required={required}
          className={`flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            invalid
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-border focus:border-accent focus:ring-accent/50"
          }`}
          aria-label="Date (ISO)"
          aria-invalid={invalid || undefined}
        />
        <input
          id={id ? `${id}-text` : undefined}
          type="text"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="e.g. 15 March 1318"
          disabled={disabled}
          required={required}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Date (display text)"
        />
      </div>
      {invalid && (
        <p className="text-xs text-red-600" role="alert">
          Use YYYY, YYYY-MM, or YYYY-MM-DD
        </p>
      )}
    </div>
  );
}
