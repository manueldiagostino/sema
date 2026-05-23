"use client";

import React from "react";
import type { AdHocField } from "@/types/form";

interface AdHocFieldsProps {
  fields: AdHocField[];
  onChange: (fields: AdHocField[]) => void;
  disabled?: boolean;
}

export default function AdHocFields({
  fields,
  onChange,
  disabled = false,
}: AdHocFieldsProps) {
  const addField = () => {
    onChange([...fields, { key: "", value: "" }]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof AdHocField, newValue: string) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: newValue };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={index} className="flex gap-2 items-start">
          <input
            type="text"
            value={field.key}
            onChange={(e) => updateField(index, "key", e.target.value)}
            placeholder="Key (becomes @type attribute)"
            disabled={disabled}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Custom property key ${index + 1}`}
          />
          <input
            type="text"
            value={field.value}
            onChange={(e) => updateField(index, "value", e.target.value)}
            placeholder="Value"
            disabled={disabled}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Custom property value ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeField(index)}
            disabled={disabled}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Remove custom property ${index + 1}`}
          >
            Delete
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        disabled={disabled}
        className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Add custom property
      </button>
    </div>
  );
}
