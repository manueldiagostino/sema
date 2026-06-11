"use client";

import React from "react";
import type { SelectOption } from "@/types/form";

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  required?: boolean;
}

export default function SelectField({
  value,
  onChange,
  options,
  disabled = false,
  id,
  placeholder = "Select an option",
  required = false,
}: SelectFieldProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
