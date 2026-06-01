"use client";

import React, { useCallback, useMemo } from "react";
import type { ExclusiveOptionConfig, WitnessEntry } from "@/types/form";

interface DynamicListFieldBaseProps {
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

interface DynamicListFieldStringProps extends DynamicListFieldBaseProps {
  values: string[];
  onChange: (values: string[]) => void;
  exclusiveOption?: never;
}

interface DynamicListFieldWitnessProps extends DynamicListFieldBaseProps {
  values: WitnessEntry[];
  onChange: (values: WitnessEntry[]) => void;
  exclusiveOption: ExclusiveOptionConfig;
}

type DynamicListFieldProps = DynamicListFieldStringProps | DynamicListFieldWitnessProps;

export default function DynamicListField(props: DynamicListFieldProps) {
  const {
    placeholder = "Enter value",
    disabled = false,
    id,
    required = false,
  } = props;

  const hasExclusive = props.exclusiveOption !== undefined && props.exclusiveOption !== null;

  // --- String[] mode (original behavior) ---
  if (!hasExclusive) {
    const { values, onChange } = props as DynamicListFieldStringProps;

    const addItem = () => {
      onChange([...values, ""]);
    };

    const removeItem = (index: number) => {
      onChange(values.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, newValue: string) => {
      const updated = [...values];
      updated[index] = newValue;
      onChange(updated);
    };

    return (
      <div className="space-y-2">
        {values.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              id={id ? `${id}-${index}` : undefined}
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              required={required && index === 0}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={disabled}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Remove item ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          disabled={disabled}
          className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>
    );
  }

  // --- WitnessEntry[] mode (exclusiveOption present) ---
  const { values, onChange, exclusiveOption } = props as DynamicListFieldWitnessProps;
  const radioName = useMemo(() => `exclusive-${exclusiveOption.fieldKey}-${id ?? "list"}`, [exclusiveOption.fieldKey, id]);

  const addItem = useCallback(() => {
    onChange([...values, { name: "", is_investitor: false }]);
  }, [values, onChange]);

  const removeItem = useCallback((index: number) => {
    onChange(values.filter((_, i) => i !== index));
  }, [values, onChange]);

  const updateItem = useCallback((index: number, newName: string) => {
    const updated = values.map((entry, i) =>
      i === index ? { ...entry, name: newName } : entry
    );
    onChange(updated);
  }, [values, onChange]);

  const setInvestitor = useCallback((index: number) => {
    const updated = values.map((entry, i) => ({
      ...entry,
      is_investitor: i === index,
    }));
    onChange(updated);
  }, [values, onChange]);

  return (
    <div className="space-y-2">
      {values.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            id={id ? `${id}-${index}` : undefined}
            type="text"
            value={entry.name}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            required={required && index === 0}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label className="flex items-center gap-1 text-sm text-foreground whitespace-nowrap">
            <input
              type="radio"
              name={radioName}
              checked={entry.is_investitor}
              onChange={() => setInvestitor(index)}
              disabled={disabled}
              className="h-3.5 w-3.5 border-border text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {exclusiveOption.label}
          </label>
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Remove item ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Add
      </button>
    </div>
  );
}
