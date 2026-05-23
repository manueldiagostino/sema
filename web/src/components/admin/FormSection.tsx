"use client";

import React from "react";
import type { FormSectionConfig, DateFieldValue } from "@/types/form";
import FormField from "./FormField";

interface FormSectionProps {
  section: FormSectionConfig;
  fieldValues: Record<string, string | string[] | DateFieldValue | undefined>;
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue) => void;
  disabled?: boolean;
  validationErrors?: Record<string, string>;
}

export default function FormSection({
  section,
  fieldValues,
  onFieldChange,
  disabled = false,
  validationErrors = {},
}: FormSectionProps) {
  return (
    <section className="border border-border rounded-lg p-6 bg-white">
      <h2 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-border">
        {section.label}
      </h2>
      <div className="space-y-4">
        {section.fields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={fieldValues[field.id]}
            onChange={(value) => onFieldChange(field.id, value)}
            disabled={disabled}
            validationError={validationErrors[field.id]}
          />
        ))}
      </div>
    </section>
  );
}
