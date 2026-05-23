"use client";

import React from "react";
import type { DateFieldValue } from "@/types/form";

interface DateFieldProps {
  value: DateFieldValue;
  onChange: (value: DateFieldValue) => void;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

export default function DateField({
  value,
  onChange,
  disabled = false,
  id,
  required = false,
}: DateFieldProps) {
  return (
    <div className="flex gap-3">
      <input
        id={id ? `${id}-iso` : undefined}
        type="date"
        value={value.iso}
        onChange={(e) => onChange({ ...value, iso: e.target.value })}
        disabled={disabled}
        required={required}
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Date (ISO)"
      />
      <input
        id={id ? `${id}-text` : undefined}
        type="text"
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="e.g. 15 March 1318"
        disabled={disabled}
        required={required}
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Date (display text)"
      />
    </div>
  );
}
