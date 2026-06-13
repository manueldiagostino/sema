"use client";

import React, { useCallback, useMemo } from "react";
import type { ExclusiveOptionConfig, LevelFieldConfig, PlaceEntry, WitnessEntry } from "@/types/form";

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

interface DynamicListFieldPlaceProps extends DynamicListFieldBaseProps {
  values: PlaceEntry[];
  onChange: (values: PlaceEntry[]) => void;
  exclusiveOption?: never;
  levelField: LevelFieldConfig;
}

type DynamicListFieldProps = DynamicListFieldStringProps | DynamicListFieldWitnessProps | DynamicListFieldPlaceProps;

export default function DynamicListField(props: DynamicListFieldProps) {
  const {
    placeholder = "Enter value",
    disabled = false,
    id,
    required = false,
  } = props;

  const hasExclusive = props.exclusiveOption !== undefined && props.exclusiveOption !== null;
  const hasLevelField = (props as DynamicListFieldPlaceProps).levelField !== undefined;

  // --- PlaceEntry[] mode (level_field present) ---
  if (hasLevelField) {
    const { values, onChange } = props as DynamicListFieldPlaceProps;

    const addItem = useCallback(() => {
      onChange([...values, { name: "", level: "" }]);
    }, [values, onChange]);

    const removeItem = useCallback((index: number) => {
      onChange(values.filter((_, i) => i !== index));
    }, [values, onChange]);

    const updateName = useCallback((index: number, newName: string) => {
      const updated = values.map((entry, i) =>
        i === index ? { ...entry, name: newName } : entry
      );
      onChange(updated);
    }, [values, onChange]);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      (e.currentTarget as HTMLElement).closest("[data-draggable]")?.classList.add("opacity-50");
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
      (e.currentTarget as HTMLElement).closest("[data-draggable]")?.classList.remove("opacity-50");
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (dragIndex === dropIndex || isNaN(dragIndex)) return;
      const updated = [...values];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, removed);
      onChange(updated);
    }, [values, onChange]);

    return (
      <div className="space-y-2">
        {values.map((entry, index) => (
          <div
            key={index}
            data-draggable
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="flex items-center gap-2 cursor-default"
          >
            <span
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
              aria-label={`Drag to reorder item ${index + 1}`}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8-16a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
              </svg>
            </span>
            <input
              id={id ? `${id}-${index}` : undefined}
              type="text"
              value={entry.name}
              onChange={(e) => updateName(index, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              required={required && index === 0}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={disabled}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-accent hover:bg-accent/10 hover:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>
    );
  }

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
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={disabled}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-accent hover:bg-accent/10 hover:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
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
    const updated = values.map((entry, i) => {
      if (i === index) {
        return { ...entry, is_investitor: !entry.is_investitor };
      }
      return { ...entry, is_investitor: false };
    });
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
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label className="flex items-center gap-1 text-sm text-foreground whitespace-nowrap">
            <input
              type="radio"
              name={radioName}
              checked={entry.is_investitor}
              onChange={() => setInvestitor(index)}
              disabled={disabled}
              className="h-3.5 w-3.5 border-border text-accent focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {exclusiveOption.label}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); setInvestitor(index); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInvestitor(index); }}}
              className={`ml-0.5 text-xs leading-none select-none ${entry.is_investitor ? "text-muted cursor-pointer hover:text-red-600" : "invisible pointer-events-none"}`}
              aria-label={`Clear ${exclusiveOption.label}`}
              title={`Clear ${exclusiveOption.label}`}
            >
              ✕
            </span>
          </label>
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-accent hover:bg-accent/10 hover:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Add
      </button>
    </div>
  );
}
