"use client";

import React, { useState, useMemo } from "react";
import type {
  FormViewConfig,
  FormTab,
  FormSection as FormSectionType,
  FormField,
  TeiSchema,
  Option,
} from "@/types/schema";
import type {
  DateFieldValue,
  WitnessEntry,
  PlaceEntry,
} from "@/types/form";
import TextField from "@/components/admin/fields/TextField";
import TextAreaField from "@/components/admin/fields/TextAreaField";
import DateField from "@/components/admin/fields/DateField";
import SelectField from "@/components/admin/fields/SelectField";
import RadioField from "@/components/admin/fields/RadioField";
import DynamicListField from "@/components/admin/fields/DynamicListField";

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldValue = string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;

export interface FormViewProps {
  /** Form view configuration. */
  config: FormViewConfig;
  /** Merged TEI schema (for element metadata). */
  schema: TeiSchema;
  /** Current form data values, keyed by field ID. */
  formData: Record<string, FieldValue>;
  /** Callback when a field value changes. */
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  /** Whether the form is disabled (e.g. during submission). */
  disabled?: boolean;
  /** Validation errors keyed by field ID. */
  validationErrors?: Record<string, string>;
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

/** Resolve a field's label from form config or schema. */
function resolveLabel(formField: FormField, schema: TeiSchema): string {
  return formField.label ?? schema.elements[formField.id]?.label ?? formField.id;
}

/** Resolve a field's cardinality from schema. */
function resolveCardinality(formField: FormField, schema: TeiSchema): "single" | "multiple" {
  return schema.elements[formField.id]?.cardinality === "multiple" ? "multiple" : "single";
}

/** Collect all FormField objects from a config (including nested sections). */
function collectAllFields(config: FormViewConfig): FormField[] {
  const fields: FormField[] = [];
  for (const tab of config.tabs?.items ?? []) {
    if (tab.fields) fields.push(...tab.fields);
    if (tab.sections) {
      const walk = (sections: FormSectionType[]) => {
        for (const s of sections) {
          fields.push(...s.fields);
          if (s.subsections) walk(s.subsections);
        }
      };
      walk(tab.sections);
    }
  }
  return fields;
}

// ── Field Widget Renderer ─────────────────────────────────────────────────────

interface FieldWidgetProps {
  formField: FormField;
  value: FieldValue;
  onChange: (value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  disabled?: boolean;
  schema: TeiSchema;
}

/** Render a single-value field widget. */
function SingleValueWidget({
  formField,
  value,
  onChange,
  disabled,
  schema,
  required,
}: FieldWidgetProps & { required?: boolean }) {
  const inputType = resolveInputType(formField, schema.elements[formField.id]);
  const strValue = typeof value === "string" ? value : "";

  switch (inputType) {
    case "text":
      return (
        <TextField
          id={formField.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          placeholder={resolveLabel(formField, schema)}
          disabled={disabled}
          required={required}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          id={formField.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          placeholder={resolveLabel(formField, schema)}
          disabled={disabled}
          rows={4}
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
          id={formField.id}
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
          id={formField.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          options={(formField.options ?? schema.elements[formField.id]?.options ?? []) as { value: string; label: string }[]}
          disabled={disabled}
          required={required}
        />
      );
    case "choice":
      return (
        <RadioField
          id={formField.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          options={(formField.options ?? schema.elements[formField.id]?.options ?? []) as { value: string; label: string }[]}
          disabled={disabled}
          required={required}
        />
      );
    case "dynamic-list": {
      const elem = schema.elements[formField.id];
      const levelField = formField.level_field ?? elem?.level_field;
      const exclusiveOption = formField.exclusive_option ?? elem?.exclusive_option;

      if (levelField) {
        const placeValues: PlaceEntry[] =
          Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "name" in value[0] && "level" in value[0]
            ? (value as PlaceEntry[])
            : [];
        return (
          <DynamicListField
            id={formField.id}
            values={placeValues}
            onChange={(v: PlaceEntry[]) => onChange(v)}
            placeholder={resolveLabel(formField, schema)}
            disabled={disabled}
            required={required}
            levelField={levelField}
          />
        );
      }
      if (exclusiveOption) {
        const witnessValues: WitnessEntry[] =
          Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "name" in value[0]
            ? (value as WitnessEntry[])
            : [];
        return (
          <DynamicListField
            id={formField.id}
            values={witnessValues}
            onChange={(v: WitnessEntry[]) => onChange(v)}
            placeholder={resolveLabel(formField, schema)}
            disabled={disabled}
            required={required}
            exclusiveOption={exclusiveOption}
          />
        );
      }
      const listValues: string[] = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
      return (
        <DynamicListField
          id={formField.id}
          values={listValues}
          onChange={(v: string[]) => onChange(v)}
          placeholder={resolveLabel(formField, schema)}
          disabled={disabled}
          required={required}
        />
      );
    }
    default:
      return null;
  }
}

/** Render a multiple-value field widget. */
function MultipleValueWidget({
  formField,
  value,
  onChange,
  disabled,
  schema,
  required,
}: FieldWidgetProps & { required?: boolean }) {
  const inputType = resolveInputType(formField, schema.elements[formField.id]);

  // dynamic-list handles its own list
  if (inputType === "dynamic-list") {
    return (
      <SingleValueWidget
        formField={formField}
        value={value}
        onChange={onChange}
        disabled={disabled}
        schema={schema}
        required={required}
      />
    );
  }

  // Radio with multiple cardinality → checkbox group
  if (inputType === "choice") {
    const options = (formField.options ?? schema.elements[formField.id]?.options ?? []) as { value: string; label: string }[];
    const selectedValues: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggleOption = (optValue: string) => {
      if (selectedValues.includes(optValue)) {
        onChange(selectedValues.filter((v) => v !== optValue));
      } else {
        onChange([...selectedValues, optValue]);
      }
    };
    return (
      <div className="flex flex-wrap gap-4" role="group">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex items-center gap-2 text-sm text-foreground${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={selectedValues.includes(opt.value)}
              onChange={() => toggleOption(opt.value)}
              disabled={disabled}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  const values: string[] = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [""];

  const addItem = () => onChange([...values, ""]);
  const removeItem = (index: number) => onChange(values.filter((_, i) => i !== index));
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
            {inputType === "text" && (
              <TextField
                id={`${formField.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                placeholder={resolveLabel(formField, schema)}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
            {inputType === "textarea" && (
              <TextAreaField
                id={`${formField.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                placeholder={resolveLabel(formField, schema)}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
            {inputType === "select" && (
              <SelectField
                id={`${formField.id}-${index}`}
                value={item}
                onChange={(v) => updateItem(index, v)}
                options={(formField.options ?? schema.elements[formField.id]?.options ?? []) as { value: string; label: string }[]}
                disabled={disabled}
                required={required && index === 0}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => removeItem(index)}
            disabled={disabled}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Remove ${resolveLabel(formField, schema)} item ${index + 1}`}
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

/** Render a single form field: label + widget + validation error. */
function FieldRenderer({
  formField,
  value,
  onChange,
  disabled,
  schema,
  validationError,
}: {
  formField: FormField;
  value: FieldValue;
  onChange: (value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  disabled?: boolean;
  schema: TeiSchema;
  validationError?: string;
}) {
  const label = resolveLabel(formField, schema);
  const cardinality = resolveCardinality(formField, schema);
  const required = formField.required;

  return (
    <div className="space-y-1">
      <label
        htmlFor={formField.id}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {cardinality === "multiple" ? (
        <MultipleValueWidget
          formField={formField}
          value={value}
          onChange={onChange}
          disabled={disabled}
          schema={schema}
          required={required}
        />
      ) : (
        <SingleValueWidget
          formField={formField}
          value={value}
          onChange={onChange}
          disabled={disabled}
          schema={schema}
          required={required}
        />
      )}
      {validationError && (
        <p className="text-xs text-red-600 mt-1" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}

// ── Section Renderer ──────────────────────────────────────────────────────────

interface SectionRendererProps {
  section: FormSectionType;
  formData: Record<string, FieldValue>;
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  disabled?: boolean;
  validationErrors?: Record<string, string>;
  schema: TeiSchema;
  depth?: number;
}

function SectionRenderer({
  section,
  formData,
  onFieldChange,
  disabled,
  validationErrors = {},
  schema,
  depth = 0,
}: SectionRendererProps) {
  const sectionClass =
    depth >= 3
      ? "mt-3 ml-2 pl-3 border-l-2 border-l-accent/40"
      : depth >= 2
        ? "mt-4 border-l-2 border-l-accent/70 bg-muted/40 p-4 rounded-r-md"
        : depth >= 1
          ? "mt-5 border border-border/70 rounded-lg p-5 bg-primary-container/50 border-l-[3px] border-l-secondary"
          : "border border-border rounded-lg p-6 bg-background";

  const headingClass =
    depth >= 3
      ? "text-xs font-semibold text-secondary/80 uppercase tracking-wider mb-2"
      : depth >= 2
        ? "text-sm font-semibold text-secondary uppercase tracking-wide mb-3"
        : depth >= 1
          ? "text-base font-semibold text-primary mb-3 pb-2 border-b border-secondary/30"
          : "text-lg font-semibold text-primary mb-4 pb-2 border-b border-border";

  const HeadingTag = depth >= 3 ? ("h4" as const) : depth >= 2 ? ("h3" as const) : ("h2" as const);

  // Render fields with field_pair grouping
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < section.fields.length; i++) {
    const formField = section.fields[i];

    // Check if this field and the next share a field_pair
    if (
      formField.field_pair &&
      i + 1 < section.fields.length &&
      section.fields[i + 1].field_pair === formField.field_pair
    ) {
      const nextField = section.fields[i + 1];
      const fieldInput = resolveInputType(formField, schema.elements[formField.id]);
      const nextInput = resolveInputType(nextField, schema.elements[nextField.id]);
      const compactInputs = new Set(["text", "choice", "date", "select"]);
      const isInline = compactInputs.has(fieldInput) && compactInputs.has(nextInput);

      elements.push(
        <div
          key={`pair-${formField.field_pair}`}
          className={
            isInline
              ? "space-y-3"
              : "space-y-3 p-3 rounded-md border border-dashed border-primary/20 bg-primary/5"
          }
        >
          <p className="text-sm font-medium text-foreground">
            {resolveLabel(formField, schema)}
          </p>
          <div className={isInline ? "flex items-center gap-4" : "space-y-2"}>
            <div className={isInline ? "flex-1" : ""}>
              <FieldRenderer
                formField={{ ...formField, label: "" }}
                value={formData[formField.id]}
                onChange={(v) => onFieldChange(formField.id, v)}
                disabled={disabled}
                schema={schema}
                validationError={validationErrors[formField.id]}
              />
            </div>
            <div className={isInline ? "shrink-0" : ""}>
              <FieldRenderer
                formField={{
                  ...nextField,
                  label: isInline
                    ? ""
                    : nextField.label?.includes("normalized")
                      ? "Name (normalized)"
                      : nextField.label ?? "",
                }}
                value={formData[nextField.id]}
                onChange={(v) => onFieldChange(nextField.id, v)}
                disabled={disabled}
                schema={schema}
                validationError={validationErrors[nextField.id]}
              />
            </div>
          </div>
        </div>,
      );
      i++; // skip the paired field
    } else {
      elements.push(
        <FieldRenderer
          key={formField.id}
          formField={formField}
          value={formData[formField.id]}
          onChange={(v) => onFieldChange(formField.id, v)}
          disabled={disabled}
          schema={schema}
          validationError={validationErrors[formField.id]}
        />,
      );
    }
  }

  return (
    <section className={sectionClass}>
      <HeadingTag className={headingClass}>{section.label}</HeadingTag>
      <div className="space-y-4">{elements}</div>
      {section.subsections?.map((sub) => (
        <SectionRenderer
          key={sub.id}
          section={sub}
          formData={formData}
          onFieldChange={onFieldChange}
          disabled={disabled}
          validationErrors={validationErrors}
          schema={schema}
          depth={(depth ?? 0) + 1}
        />
      ))}
    </section>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FormView({
  config,
  schema,
  formData,
  onFieldChange,
  disabled = false,
  validationErrors = {},
}: FormViewProps) {
  const tabs = config.tabs?.items ?? [];

  // Split tabs into always_visible and regular
  const alwaysVisibleTabs = useMemo(
    () => tabs.filter((t) => t.type === "always_visible"),
    [tabs],
  );
  const regularTabs = useMemo(
    () => tabs.filter((t) => t.type !== "always_visible"),
    [tabs],
  );

  // Active tab state
  const [activeFormTab, setActiveFormTab] = useState<string>(() => {
    return config.tabs?.defaultTab ?? regularTabs[0]?.id ?? "";
  });

  const activeTabData = useMemo(
    () => regularTabs.find((t) => t.id === activeFormTab) ?? regularTabs[0],
    [regularTabs, activeFormTab],
  );

  const isSpecialTab = activeTabData?.type === "special";

  return (
    <>
      {/* Always-visible sections (rendered above tabs) */}
      {alwaysVisibleTabs.map((tab) => (
        <div key={tab.id} className="mb-6">
          {tab.fields && tab.fields.length > 0 && (
            <SectionRenderer
              section={{
                id: tab.id,
                label: tab.label,
                fields: tab.fields,
              }}
              formData={formData}
              onFieldChange={onFieldChange}
              disabled={disabled}
              validationErrors={validationErrors}
              schema={schema}
              depth={0}
            />
          )}
        </div>
      ))}

      {/* Tab bar */}
      {regularTabs.length > 0 && (
        <div className="border-b border-border">
          <div className="flex gap-0 -mb-px">
            {regularTabs.map((tab) => {
              const tabLabel = tab.label;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFormTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeFormTab === tab.id
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div key={activeFormTab} className="animate-fade-in">
        {/* Special tabs: fulltext */}
        {isSpecialTab && activeTabData.id === "fulltext" && (
          <div className="border border-border rounded-lg p-6 bg-background">
            <label
              htmlFor="full_text"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Integral Text
            </label>
            <textarea
              id="full_text"
              value={typeof formData.full_text === "string" ? formData.full_text : ""}
              onChange={(e) => onFieldChange("full_text", e.target.value)}
              rows={15}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              placeholder="Enter the integral text of the charter…"
              disabled={disabled}
            />
          </div>
        )}

        {/* Special tabs: image */}
        {isSpecialTab && activeTabData.id === "image" && (
          <div className="border border-border rounded-lg p-6 bg-background text-center">
            <p className="text-sm text-muted-foreground">Image upload coming soon</p>
          </div>
        )}

        {/* Regular tabs with sections */}
        {!isSpecialTab && activeTabData?.sections && activeTabData.sections.length > 0 && (
          <div className="space-y-6">
            {activeTabData.sections.map((section) => (
              <SectionRenderer
                key={section.id}
                section={section}
                formData={formData}
                onFieldChange={onFieldChange}
                disabled={disabled}
                validationErrors={validationErrors}
                schema={schema}
                depth={0}
              />
            ))}
          </div>
        )}

        {/* Regular tabs with flat fields (no sections) */}
        {!isSpecialTab && activeTabData?.fields && activeTabData.fields.length > 0 && !activeTabData.sections && (
          <div className="space-y-6">
            <SectionRenderer
              section={{
                id: activeTabData.id,
                label: activeTabData.label,
                fields: activeTabData.fields,
              }}
              formData={formData}
              onFieldChange={onFieldChange}
              disabled={disabled}
              validationErrors={validationErrors}
              schema={schema}
              depth={0}
            />
          </div>
        )}
      </div>
    </>
  );
}

// Re-export collectAllFields for use by AdminFormPage
export { collectAllFields };
