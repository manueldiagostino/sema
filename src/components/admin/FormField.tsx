"use client";

import React from "react";
import type { FormFieldConfig, DateFieldValue } from "@/types/form";
import TextField from "./fields/TextField";
import TextAreaField from "./fields/TextAreaField";
import DateField from "./fields/DateField";
import SelectField from "./fields/SelectField";
import DynamicListField from "./fields/DynamicListField";

interface FormFieldProps {
  field: FormFieldConfig;
  value: string | string[] | DateFieldValue | undefined;
  onChange: (value: string | string[] | DateFieldValue) => void;
  disabled?: boolean;
  validationError?: string;
}

function SingleValueInput({
  field,
  value,
  onChange,
  disabled,
  required,
}: {
  field: FormFieldConfig;
  value: string | string[] | DateFieldValue | undefined;
  onChange: (value: string | string[] | DateFieldValue) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const strValue = typeof value === "string" ? value : "";

  switch (field.input) {
    case "text":
      return (
        <TextField
          id={field.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          placeholder={field.label}
          disabled={disabled}
          required={required}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          id={field.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          placeholder={field.label}
          disabled={disabled}
          rows={field.input === "textarea" ? 4 : undefined}
          required={required}
        />
      );
    case "date": {
      const dateValue: DateFieldValue =
        value && typeof value === "object" && "iso" in value
          ? (value as DateFieldValue)
          : { iso: "", text: "" };
      return (
        <DateField
          id={field.id}
          value={dateValue}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          required={required}
        />
      );
    }
    case "select":
      return (
        <SelectField
          id={field.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          options={field.options ?? []}
          disabled={disabled}
          required={required}
        />
      );
    case "dynamic-list": {
      const listValues: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];
      return (
        <DynamicListField
          id={field.id}
          values={listValues}
          onChange={(v) => onChange(v)}
          placeholder={field.label}
          disabled={disabled}
          required={required}
        />
      );
    }
    default:
      return null;
  }
}

function MultipleValueInput({
  field,
  value,
  onChange,
  disabled,
  required,
}: {
  field: FormFieldConfig;
  value: string | string[] | DateFieldValue | undefined;
  onChange: (value: string | string[] | DateFieldValue) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  // For dynamic-list, delegate to the single input (it handles its own list)
  if (field.input === "dynamic-list") {
    return (
      <SingleValueInput
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      />
    );
  }

  const values: string[] = Array.isArray(value) ? value : value ? [String(value)] : [""];

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
          <div className="flex-1">
            {field.input === "text" && (
              <TextField
                id={`${field.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                placeholder={field.label}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
            {field.input === "textarea" && (
              <TextAreaField
                id={`${field.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                placeholder={field.label}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
            {field.input === "select" && (
              <SelectField
                id={`${field.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                options={field.options ?? []}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Remove ${field.label} item ${index + 1}`}
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

export default function FormField({
  field,
  value,
  onChange,
  disabled = false,
  validationError,
}: FormFieldProps) {
  const isMultiple = field.cardinality === "multiple";

  return (
    <div className="space-y-1">
      <label
        htmlFor={field.id}
        className="block text-sm font-medium text-foreground"
      >
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {isMultiple ? (
        <MultipleValueInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={field.required}
        />
      ) : (
        <SingleValueInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={field.required}
        />
      )}
      {validationError && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          {validationError}
        </p>
      )}
      {field.note && !validationError && (
        <p className="text-xs text-gray-500 mt-1">{field.note}</p>
      )}
    </div>
  );
}
