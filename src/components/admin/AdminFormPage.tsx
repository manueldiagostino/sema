"use client";

import React, { useState, useCallback, type FormEvent } from "react";
import type {
  FormSectionsConfig,
  FormSectionConfig,
  FormFieldConfig,
  DateFieldValue,
  WitnessEntry,
  AdHocField,
  FormSubmissionData,
} from "@/types/form";
import CharterTypeSelector from "./CharterTypeSelector";
import FormSection from "./FormSection";
import AdHocFields from "./AdHocFields";

interface AdminFormPageProps {
  config: FormSectionsConfig;
}

function getInitialFieldValue(
  field: FormFieldConfig,
  charterType: string,
): string | string[] | DateFieldValue | WitnessEntry[] {
  // Determine default value
  let defaultStr = "";
  if (field.default_by_type && field.default_by_type[charterType]) {
    defaultStr = field.default_by_type[charterType];
  } else if (field.default_value) {
    defaultStr = field.default_value;
  }

  // Return based on cardinality and input type
  if (field.cardinality === "multiple") {
    return defaultStr ? [defaultStr] : [];
  }

  if (field.input === "date") {
    return { iso: "", text: "" } as DateFieldValue;
  }

  if (field.input === "radio") {
    if (defaultStr) return defaultStr;
    if (field.options && field.options.length > 0) return field.options[0].value;
    return "";
  }

  if (field.input === "dynamic-list" && field.exclusive_option) {
    return [] as WitnessEntry[];
  }

  return defaultStr;
}

function initializeFieldValues(
  sections: FormSectionConfig[],
  charterType: string,
): Record<string, string | string[] | DateFieldValue | WitnessEntry[] | undefined> {
  const values: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | undefined> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      values[field.id] = getInitialFieldValue(field, charterType);
    }
  }
  return values;
}

function appliesToCurrentType(
  appliesTo: "all" | string[],
  charterType: string,
): boolean {
  if (appliesTo === "all") return true;
  if (Array.isArray(appliesTo)) return appliesTo.includes(charterType);
  return false;
}

export default function AdminFormPage({ config }: AdminFormPageProps) {
  const { types, sections } = config;

  const [charterType, setCharterType] = useState("");
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | string[] | DateFieldValue | WitnessEntry[] | undefined>
  >({});
  const [adHoc, setAdHoc] = useState<AdHocField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleCharterTypeChange = useCallback(
    (typeId: string) => {
      setCharterType(typeId);
      setError(null);
      setSuccess(null);

      if (!typeId) {
        setFieldValues({});
        return;
      }

      // Initialize all field values with defaults
      const newValues = initializeFieldValues(sections, typeId);

      setFieldValues(newValues);
    },
    [sections, types],
  );

  const handleFieldChange = useCallback(
    (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[]) => {
      setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
      // Clear validation error for this field when user edits it
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [],
  );

  function isValueEmpty(value: string | string[] | DateFieldValue | WitnessEntry[] | undefined): boolean {
    if (value === undefined || value === "") return true;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first && typeof first === "object" && "name" in first) {
        const entries = value as WitnessEntry[];
        return entries.length === 0 || entries.every((e) => e.name.trim() === "");
      }
      return value.length === 0 || value.every((v) => (v as string).trim() === "");
    }
    if (typeof value === "object" && "iso" in value) {
      const dateVal = value as DateFieldValue;
      return dateVal.iso.trim() === "" && dateVal.text.trim() === "";
    }
    if (typeof value === "string") {
      return value.trim() === "";
    }
    return true;
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    for (const section of visibleSections) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const value = fieldValues[field.id];
        if (isValueEmpty(value)) {
          errors[field.id] = `${field.label} is required.`;
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleClearForm() {
    setCharterType("");
    setFieldValues({});
    setAdHoc([]);
    setSuccess(null);
    setError(null);
    setValidationErrors({});
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!charterType) {
      setError("Please select a charter type.");
      return;
    }

    // Client-side validation for required fields
    if (!validateForm()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const submissionData: FormSubmissionData = {
      charter_type: charterType,
      fields: { ...fieldValues },
      ad_hoc: adHoc,
    };

    try {
      const res = await fetch("/api/admin/xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Document created: ${data.filename ?? "document.xml"}`);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create document.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter sections by applies_to
  const visibleSections = sections.filter((s) =>
    appliesToCurrentType(s.applies_to, charterType),
  );

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">
              Create TEI Document
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Fill out the form below to generate a new TEI XML document.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              fetch("/api/admin/logout", { method: "POST" }).then(() => {
                window.location.href = "/admin";
              });
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            Logout
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Charter Type Selector */}
          <div className="border border-border rounded-lg p-6 bg-white">
            <CharterTypeSelector
              types={types}
              value={charterType}
              onChange={handleCharterTypeChange}
              disabled={submitting}
            />
          </div>

          {/* Form Sections */}
          {charterType &&
            visibleSections.map((section) => (
              <FormSection
                key={section.id}
                section={section}
                fieldValues={fieldValues}
                onFieldChange={handleFieldChange}
                disabled={submitting}
                validationErrors={validationErrors}
                depth={0}
              />
            ))}

          {/* Ad-Hoc Custom Properties */}
          <div className="border border-border rounded-lg p-6 bg-white">
            <h2 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-border">
              Custom Properties
            </h2>
            <AdHocFields
              fields={adHoc}
              onChange={setAdHoc}
              disabled={submitting}
            />
          </div>

          {/* Status Messages */}
          {success && (
            <div
              className="rounded-md border border-green-200 bg-green-50 px-4 py-3"
              role="alert"
            >
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {error && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3"
              role="alert"
            >
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClearForm}
              disabled={submitting}
              className="rounded-md border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={submitting || !charterType}
              className="rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating document..." : "Create Document"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
