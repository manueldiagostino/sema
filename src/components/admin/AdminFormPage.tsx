"use client";

import React, { useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import type {
  FormViewConfig,
  FormSection,
  FormField,
  FormTab,
  TeiSchema,
} from "@/types/schema";
import type {
  DateFieldValue,
  WitnessEntry,
  PlaceEntry,
  AdHocField,
  FormSubmissionData,
} from "@/types/form";
import CharterTypeSelector from "./CharterTypeSelector";
import FormView, { collectAllFields } from "@/components/engine/FormView";
import AdHocFields from "./AdHocFields";

type FieldValue = string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;

interface AdminFormPageProps {
  /** Form view configuration (merged base + per-type). */
  formConfig: FormViewConfig;
  /** Merged TEI schema (for element metadata). */
  schema: TeiSchema;
  /** Available charter types for the type selector. */
  charterTypes: Array<{ id: string; label: string; object_value?: string; object_subtype_value?: string }>;
  /** Parsed field values for edit mode (from xmlParser). */
  initialValues?: Record<string, unknown>;
  /** Charter type ID locked in edit mode — hides the type selector. */
  lockedCharterType?: string;
  /** Original filename when editing an existing document. */
  editFilename?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the input type for a FormField, falling back to schema element type. */
function resolveInputType(
  formField: FormField,
  elem?: { type: string },
): "text" | "textarea" | "date" | "select" | "choice" | "dynamic-list" {
  if (formField.input) return formField.input;
  switch (elem?.type) {
    case "date": return "date";
    case "enum": return "choice";
    case "entity": return "dynamic-list";
    default: return "text";
  }
}

/** Resolve initial value for a single field. */
function getInitialFieldValue(
  formField: FormField,
  schema: TeiSchema,
  _charterType: string,
): FieldValue {
  const elem = schema.elements[formField.id];
  const inputType = resolveInputType(formField, elem);
  const defaultStr = formField.default_value ?? elem?.default_value ?? "";

  if (elem?.cardinality === "multiple") {
    return defaultStr ? [defaultStr] : [];
  }

  if (inputType === "date") {
    return { iso: defaultStr || "", text: "" } as DateFieldValue;
  }

  if (inputType === "choice") {
    if (defaultStr) return defaultStr;
    const options = formField.options ?? elem?.options;
    if (options && options.length > 0) return options[0].value;
    return "";
  }

  if (inputType === "dynamic-list") {
    const levelField = formField.level_field ?? elem?.level_field;
    if (levelField) return [] as PlaceEntry[];
    const exclusiveOption = formField.exclusive_option ?? elem?.exclusive_option;
    if (exclusiveOption) return [] as WitnessEntry[];
    return [];
  }

  return defaultStr;
}

/** Initialize field values for all fields in the form config. */
function initializeFieldValues(
  config: FormViewConfig,
  schema: TeiSchema,
  charterType: string,
): Record<string, FieldValue> {
  const allFields = collectAllFields(config);
  const values: Record<string, FieldValue> = {};
  for (const field of allFields) {
    values[field.id] = getInitialFieldValue(field, schema, charterType);
  }
  return values;
}

/** Check if a value is empty for validation purposes. */
function isValueEmpty(value: FieldValue): boolean {
  if (value === undefined || value === "") return true;
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "name" in first) {
      if ("level" in first) {
        const entries = value as PlaceEntry[];
        return entries.length === 0 || entries.every((e) => e.name.trim() === "");
      }
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

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminFormPage({
  formConfig,
  schema,
  charterTypes,
  initialValues,
  lockedCharterType,
  editFilename,
}: AdminFormPageProps) {
  const defaultCharterType = lockedCharterType ?? charterTypes[0]?.id ?? "";

  const [charterType, setCharterType] = useState<string>(() => defaultCharterType);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>(() => {
    if (!defaultCharterType) return {};
    const defaults = initializeFieldValues(formConfig, schema, defaultCharterType);
    if (initialValues) {
      const merged = { ...defaults };
      for (const [key, value] of Object.entries(initialValues)) {
        if (value !== undefined && value !== null) {
          merged[key] = value as FieldValue;
        }
      }
      return merged;
    }
    return defaults;
  });

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

      // Re-initialize field values for the new type
      const newValues = initializeFieldValues(formConfig, schema, typeId);
      newValues.full_text = "";
      setFieldValues(newValues);
    },
    [formConfig, schema],
  );

  const handleFieldChange = useCallback(
    (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => {
      setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [],
  );

  /** Validate required fields by scanning the form config. */
  function validateForm(): boolean {
    const allFields = collectAllFields(formConfig);
    const errors: Record<string, string> = {};

    for (const field of allFields) {
      if (!field.required) continue;
      const value = fieldValues[field.id];
      if (isValueEmpty(value)) {
        const label = field.label ?? schema.elements[field.id]?.label ?? field.id;
        errors[field.id] = `${label} is required.`;
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

  const isEditMode = !!lockedCharterType;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!charterType) {
      setError("Please select a charter type.");
      return;
    }

    if (!validateForm()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const submissionData: FormSubmissionData & { mode?: "create" | "update"; filename?: string } = {
      charter_type: charterType,
      fields: { ...fieldValues },
      ad_hoc: adHoc,
    };

    if (isEditMode && editFilename) {
      submissionData.mode = "update";
      submissionData.filename = editFilename;
    }

    try {
      const res = await fetch("/api/admin/xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(
          isEditMode
            ? `Document updated: ${data.filename ?? "document.xml"}`
            : `Document created: ${data.filename ?? "document.xml"}`,
        );
      } else {
        const data = await res.json();
        setError(data.error ?? `Failed to ${isEditMode ? "update" : "create"} document.`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href="/admin"
              transitionTypes={["page"]}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent mb-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-primary">
              {isEditMode ? "Edit TEI Document" : "Create TEI Document"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEditMode
                ? "Modify the document fields below and save your changes."
                : "Fill out the form below to generate a new TEI XML document."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Charter Type Selector or Read-only Label */}
          <div className="border border-border rounded-lg p-6 bg-background">
            {isEditMode ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Charter Type
                </label>
                <p className="text-base text-foreground py-2">
                  {charterTypes.find((t) => t.id === lockedCharterType)?.label ?? lockedCharterType}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Charter type cannot be changed when editing an existing document.
                </p>
              </div>
            ) : (
              <CharterTypeSelector
                types={charterTypes.map((ct) => ({
                  id: ct.id,
                  label: ct.label,
                  object_value: ct.object_value ?? ct.label,
                  object_subtype_value: ct.object_subtype_value,
                }))}
                value={charterType}
                onChange={handleCharterTypeChange}
                disabled={submitting}
              />
            )}
          </div>

          {/* FormView renders all fields, sections, and tabs */}
          {charterType && (
            <>
              <FormView
                config={formConfig}
                schema={schema}
                formData={fieldValues}
                onFieldChange={handleFieldChange}
                disabled={submitting}
                validationErrors={validationErrors}
              />

              {/* Ad-Hoc Custom Properties */}
              <div className="border border-border rounded-lg p-6 bg-background">
                <h2 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-border">
                  Custom Properties
                </h2>
                <AdHocFields
                  fields={adHoc}
                  onChange={setAdHoc}
                  disabled={submitting}
                />
              </div>
            </>
          )}

          {/* Status Messages */}
          {success && (
            <div
              className="rounded-md bg-background border border-[var(--border)] border-l-4 border-l-green-500 px-5 py-4 shadow-sm"
              role="alert"
            >
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="h-5 w-5 text-green-500 shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-green-800 font-medium">{success}</p>
              </div>
              <div className="flex items-center gap-3 ml-7">
                <Link
                  href="/admin"
                  transitionTypes={["page"]}
                  className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  ← Back to Dashboard
                </Link>
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="inline-flex items-center rounded-md border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-muted transition-colors"
                  >
                    Create Another
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSuccess(null)}
                    className="inline-flex items-center rounded-md border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-muted transition-colors"
                  >
                    Continue Editing
                  </button>
                )}
              </div>
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
            {!isEditMode && (
              <button
                type="button"
                onClick={handleClearForm}
                disabled={submitting}
                className="rounded-md border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Form
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !charterType}
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? isEditMode
                  ? "Saving changes..."
                  : "Creating document..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Document"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
