"use client";

import React from "react";

interface TextAreaFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  rows?: number;
  required?: boolean;
}

export default function TextAreaField({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  rows = 4,
  required = false,
}: TextAreaFieldProps) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      rows={rows}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
    />
  );
}
