"use client";

import React from "react";
import type { CharterTypeConfig } from "@/types/form";

interface CharterTypeSelectorProps {
  types: CharterTypeConfig[];
  value: string;
  onChange: (typeId: string) => void;
  disabled?: boolean;
}

export default function CharterTypeSelector({
  types,
  value,
  onChange,
  disabled = false,
}: CharterTypeSelectorProps) {
  return (
    <div>
      <label
        htmlFor="charter-type"
        className="block text-sm font-medium text-foreground mb-1"
      >
        Charter Type
      </label>
      <select
        id="charter-type"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select a charter type...</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
    </div>
  );
}
