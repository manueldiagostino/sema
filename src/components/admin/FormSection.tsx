"use client";

import React, { type ReactNode } from "react";
import type { FormSectionConfig, DateFieldValue, WitnessEntry } from "@/types/form";
import FormField from "./FormField";

interface FormSectionProps {
  section: FormSectionConfig;
  fieldValues: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | undefined>;
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[]) => void;
  disabled?: boolean;
  validationErrors?: Record<string, string>;
  depth?: number;
}

export default function FormSection({
  section,
  fieldValues,
  onFieldChange,
  disabled = false,
  validationErrors = {},
  depth = 0,
}: FormSectionProps) {
  const sectionClass =
    depth >= 3
      ? "ml-4 pl-2 border-l-2 border-border/40 bg-transparent"
      : depth >= 2
        ? "ml-4 border border-border/60 rounded-lg p-4 bg-white"
        : "border border-border rounded-lg p-6 bg-white";

  const headingClass =
    depth >= 3
      ? "text-sm font-medium text-muted-foreground"
      : depth >= 2
        ? "text-base font-semibold"
        : "text-lg font-semibold";

  const HeadingTag = depth >= 3 ? "h4" : depth >= 2 ? "h3" : "h2";

  return (
    <section className={sectionClass}>
      <HeadingTag
        className={`${headingClass} ${depth >= 3 ? "" : "text-primary"} mb-4 pb-2 border-b border-border`}
      >
        {section.label}
      </HeadingTag>
      <div className="space-y-4">
        {(() => {
          const elements: ReactNode[] = [];
          for (let i = 0; i < section.fields.length; i++) {
            const field = section.fields[i];
            // Check if this field and the next share a field_pair
            if (
              field.field_pair &&
              i + 1 < section.fields.length &&
              section.fields[i + 1].field_pair === field.field_pair
            ) {
              const nextField = section.fields[i + 1];
              elements.push(
                <div
                  key={`pair-${field.field_pair}`}
                  className="space-y-3 p-3 rounded-md border border-dashed border-primary/20 bg-primary/5"
                >
                  <p className="text-sm font-medium text-foreground">
                    {field.label}
                  </p>
                  <div className="space-y-2">
                    <FormField
                      field={{
                        ...field,
                        label: nextField.label.includes("normalized")
                          ? "Context"
                          : field.label,
                      }}
                      value={fieldValues[field.id]}
                      onChange={(value) => onFieldChange(field.id, value)}
                      disabled={disabled}
                      validationError={validationErrors[field.id]}
                    />
                    <FormField
                      field={{ ...nextField, label: "Name (normalized)" }}
                      value={fieldValues[nextField.id]}
                      onChange={(value) => onFieldChange(nextField.id, value)}
                      disabled={disabled}
                      validationError={validationErrors[nextField.id]}
                    />
                  </div>
                </div>
              );
              i++; // skip the paired field
            } else {
              elements.push(
                <FormField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id]}
                  onChange={(value) => onFieldChange(field.id, value)}
                  disabled={disabled}
                  validationError={validationErrors[field.id]}
                />
              );
            }
          }
          return elements;
        })()}
      </div>
      {section.subsections?.map((sub) => (
        <FormSection
          key={sub.id}
          section={sub}
          fieldValues={fieldValues}
          onFieldChange={onFieldChange}
          disabled={disabled}
          validationErrors={validationErrors}
          depth={(depth ?? 0) + 1}
        />
      ))}
    </section>
  );
}
