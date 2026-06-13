"use client";

import React, { useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import type {
  FormSectionsConfig,
  FormSectionConfig,
  FormFieldConfig,
  DateFieldValue,
  WitnessEntry,
  PlaceEntry,
  AdHocField,
  FormSubmissionData,
} from "@/types/form";
import CharterTypeSelector from "./CharterTypeSelector";
import FormSection from "./FormSection";
import AdHocFields from "./AdHocFields";

interface AdminFormPageProps {
  config: FormSectionsConfig;
  /** Parsed field values for edit mode (from xmlParser). */
  initialValues?: Record<string, unknown>;
  /** Charter type ID locked in edit mode — hides the type selector. */
  lockedCharterType?: string;
  /** Original filename when editing an existing document. */
  editFilename?: string;
}

function getInitialFieldValue(
  field: FormFieldConfig,
  charterType: string,
): string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] {
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
    return { iso: defaultStr || "", text: "" } as DateFieldValue;
  }

  if (field.input === "radio") {
    if (defaultStr) return defaultStr;
    if (field.options && field.options.length > 0) return field.options[0].value;
    return "";
  }

  if (field.input === "dynamic-list" && field.level_field) {
    return [] as PlaceEntry[];
  }

  if (field.input === "dynamic-list" && field.exclusive_option) {
    return [] as WitnessEntry[];
  }

  return defaultStr;
}

function initializeFieldValues(
  sections: FormSectionConfig[],
  charterType: string,
): Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined> {
  const values: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined> = {};
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

export default function AdminFormPage({
  config,
  initialValues,
  lockedCharterType,
  editFilename,
}: AdminFormPageProps) {
  const { types, sections } = config;

  // Compute initial charter type and field values, incorporating edit-mode data
  // when lockedCharterType is provided. This runs once on mount via lazy init.
  const [charterType, setCharterType] = useState<string>(() => {
    return lockedCharterType || "";
  });
  const [fieldValues, setFieldValues] = useState<
    Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined>
  >(() => {
    if (!lockedCharterType) return {};
    const defaults = initializeFieldValues(sections, lockedCharterType);
    if (initialValues) {
      const merged = { ...defaults };
      for (const [key, value] of Object.entries(initialValues)) {
        if (value !== undefined && value !== null) {
          merged[key] = value as string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;
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
  const [activeFormTab, setActiveFormTab] = useState<string>("formulary");

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
      // Initialize full_text to empty string
      newValues.full_text = "";

      setFieldValues(newValues);
    },
    [sections],
  );

  const handleFieldChange = useCallback(
    (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => {
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

  function isValueEmpty(value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined): boolean {
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

  const isEditMode = !!lockedCharterType;

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

  // Filter sections by applies_to
  const visibleSections = sections.filter((s) =>
    appliesToCurrentType(s.applies_to, charterType),
  );

  // Look up the locked charter type label for display
  const lockedTypeConfig = types.find((t) => t.id === lockedCharterType);

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
                  {lockedTypeConfig?.label ?? lockedCharterType}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Charter type cannot be changed when editing an existing document.
                </p>
              </div>
            ) : (
              <CharterTypeSelector
                types={types}
                value={charterType}
                onChange={handleCharterTypeChange}
                disabled={submitting}
              />
            )}
          </div>

          {/* Form Sections */}
          {charterType && (
            <>
              {/* Properties section - always visible above tabs */}
              {visibleSections.filter(s => s.id === "properties").map((section) => (
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

              {/* Tab bar */}
              <div className="border-b border-border">
                <div className="flex gap-0 -mb-px">
                  {(["formulary", "fulltext", "image"] as const).map((tabId) => (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => setActiveFormTab(tabId)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeFormTab === tabId
                          ? "border-accent text-accent"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      {tabId === "formulary" ? "Formulary Analysis" : tabId === "fulltext" ? "Full Text" : "Image"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div key={activeFormTab} className="animate-fade-in">
                {activeFormTab === "formulary" && (
                  <div className="space-y-6">
                    {visibleSections.filter(s => s.id !== "properties").map((section) => (
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
                    {/* Ad-Hoc Custom Properties - only in Formulary Analysis */}
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
                  </div>
                )}

                {activeFormTab === "fulltext" && (
                  <div className="border border-border rounded-lg p-6 bg-background">
                    <label htmlFor="full_text" className="block text-sm font-medium text-foreground mb-2">
                      Integral Text
                    </label>
                    <textarea
                      id="full_text"
                      value={typeof fieldValues.full_text === "string" ? fieldValues.full_text : ""}
                      onChange={(e) => handleFieldChange("full_text", e.target.value)}
                      rows={15}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                      placeholder="Enter the integral text of the charter…"
                      disabled={submitting}
                    />
                  </div>
                )}

                {activeFormTab === "image" && (
                  <div className="border border-border rounded-lg p-6 bg-background text-center">
                    <p className="text-sm text-muted-foreground">Image upload coming soon</p>
                  </div>
                )}
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
