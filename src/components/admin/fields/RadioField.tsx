"use client";

import React from "react";
import type { SelectOption } from "@/types/form";

interface RadioFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

export default function RadioField({
  value,
  onChange,
  options,
  disabled = false,
  id,
  required = false,
}: RadioFieldProps) {
  return (
    <div className="flex flex-wrap gap-4" role="radiogroup" id={id}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`inline-flex items-center gap-2 text-sm text-foreground${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
        >
          <input
            type="radio"
            name={id}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={disabled}
            required={required}
            className="h-4 w-4 border-border text-accent focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
