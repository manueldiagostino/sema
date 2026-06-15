"use client";

import React, { useState, useCallback, useMemo } from "react";
import type {
  FormViewConfig,
  FormTab,
  FormSection as FormSectionType,
  FormField,
  TeiSchema,
  Option,
} from "@/types/schema";
import type {
  FormFieldConfig,
  FormSectionConfig,
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface FormViewProps {
  /** Form view configuration. */
  config: FormViewConfig;
  /** Merged TEI schema (for element metadata). */
  schema: TeiSchema;
  /** Current form data values, keyed by field ID. */
  formData: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined>;
  /** Callback when a field value changes. */
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  /** Whether the form is disabled (e.g. during submission). */
  disabled?: boolean;
  /** Validation errors keyed by field ID. */
  validationErrors?: Record<string, string>;
  /** Charter type ID for display purposes. */
  charterType?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the input type for a FormField, falling back to schema element type.
 */
function resolveInputType(
  formField: FormField,
  elem?: { type: string },
): "text" | "textarea" | "date" | "select" | "radio" | "dynamic-list" {
  if (formField.input) return formField.input;
  switch (elem?.type) {
    case "date":
      return "date";
    case "enum":
      return "radio";
    case "entity":
      return "dynamic-list";
    default:
      return "text";
  }
}

/**
 * Build a legacy FormFieldConfig from a FormField + schema element.
 */
function buildFieldConfig(
  formField: FormField,
  schema: TeiSchema,
): FormFieldConfig {
  const elem = schema.elements[formField.id];
  const input = resolveInputType(formField, elem);
  const teiElement = elem?.tei?.element ?? "";
  const teiAttributes: Record<string, string> = {};
  if (elem?.tei?.type) {
    teiAttributes.type = elem.tei.type;
  }
  const cardinality = elem?.cardinality === "multiple" ? "multiple" : "single";

  return {
    id: formField.id,
    label: formField.label ?? elem?.label ?? formField.id,
    input,
    cardinality,
    tei_element: teiElement,
    tei_attributes: Object.keys(teiAttributes).length > 0 ? teiAttributes : undefined,
    tei_wrapper: elem?.tei?.wrapper,
    tei_wrapper_attributes: elem?.tei?.wrapper_attributes,
    xpath_parent: elem?.tei?.xpath_parent ?? "",
    applies_to: "all",
    required: formField.required,
    options: formField.options as { value: string; label: string }[] | undefined,
    default_value: formField.default_value ?? elem?.default_value,
    field_pair: formField.field_pair ?? elem?.field_pair,
    exclusive_option: formField.exclusive_option ?? elem?.exclusive_option,
    level_field: formField.level_field
      ? { key: formField.level_field.key, label: formField.level_field.key }
      : elem?.level_field
        ? { key: elem.level_field.key, label: elem.level_field.key }
        : undefined,
  };
}

/**
 * Build a legacy FormSectionConfig from a FormSection + schema.
 */
function buildSectionConfig(
  section: FormSectionType,
  schema: TeiSchema,
): FormSectionConfig {
  return {
    id: section.id,
    label: section.label,
    fields: section.fields.map((f) => buildFieldConfig(f, schema)),
    subsections: section.subsections
      ? section.subsections.map((sub) => buildSectionConfig(sub, schema))
      : undefined,
    applies_to: "all",
  };
}

// ── FormField renderer ───────────────────────────────────────────────────────

interface FormFieldRendererProps {
  field: FormFieldConfig;
  value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;
  onChange: (value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
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
  value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;
  onChange: (value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
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
    case "radio":
      return (
        <RadioField
          id={field.id}
          value={strValue}
          onChange={(v) => onChange(v)}
          options={field.options ?? []}
          disabled={disabled}
          required={required}
        />
      );
    case "dynamic-list": {
      if (field.level_field) {
        const placeValues: PlaceEntry[] =
          Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "name" in value[0] && "level" in value[0]
            ? (value as PlaceEntry[])
            : [];
        return (
          <DynamicListField
            id={field.id}
            values={placeValues}
            onChange={(v: PlaceEntry[]) => onChange(v)}
            placeholder={field.label}
            disabled={disabled}
            required={required}
            levelField={field.level_field}
          />
        );
      }
      if (field.exclusive_option) {
        const witnessValues: WitnessEntry[] =
          Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "name" in value[0]
            ? (value as WitnessEntry[])
            : [];
        return (
          <DynamicListField
            id={field.id}
            values={witnessValues}
            onChange={(v: WitnessEntry[]) => onChange(v)}
            placeholder={field.label}
            disabled={disabled}
            required={required}
            exclusiveOption={field.exclusive_option}
          />
        );
      }
      const listValues: string[] = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
      return (
        <DynamicListField
          id={field.id}
          values={listValues}
          onChange={(v: string[]) => onChange(v)}
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
  value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined;
  onChange: (value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  // For dynamic-list, delegate to single input (it handles its own list)
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

  // Radio with multiple cardinality becomes a checkbox group
  if (field.input === "radio") {
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
        {(field.options ?? []).map((opt) => (
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
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 hover:border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-accent hover:bg-accent/10 hover:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + Add
      </button>
    </div>
  );
}

function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled,
  validationError,
}: FormFieldRendererProps) {
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
    </div>
  );
}

// ── FormSection renderer ─────────────────────────────────────────────────────

interface FormSectionRendererProps {
  section: FormSectionConfig;
  formData: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined>;
  onFieldChange: (fieldId: string, value: string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[]) => void;
  disabled?: boolean;
  validationErrors?: Record<string, string>;
  depth?: number;
}

function FormSectionRenderer({
  section,
  formData,
  onFieldChange,
  disabled,
  validationErrors = {},
  depth = 0,
}: FormSectionRendererProps) {
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
    const field = section.fields[i];

    // Check if this field and the next share a field_pair
    if (
      field.field_pair &&
      i + 1 < section.fields.length &&
      section.fields[i + 1].field_pair === field.field_pair
    ) {
      const nextField = section.fields[i + 1];
      const compactInputs = new Set(["text", "radio", "date", "select"]);
      const isInline =
        compactInputs.has(field.input) && compactInputs.has(nextField.input);

      elements.push(
        <div
          key={`pair-${field.field_pair}`}
          className={
            isInline
              ? "space-y-3"
              : "space-y-3 p-3 rounded-md border border-dashed border-primary/20 bg-primary/5"
          }
        >
          <p className="text-sm font-medium text-foreground">
            {field.label}
          </p>
          <div className={isInline ? "flex items-center gap-4" : "space-y-2"}>
            <div className={isInline ? "flex-1" : ""}>
              <FormFieldRenderer
                field={{ ...field, label: "" }}
                value={formData[field.id]}
                onChange={(value) => onFieldChange(field.id, value)}
                disabled={disabled}
                validationError={validationErrors[field.id]}
              />
            </div>
            <div className={isInline ? "shrink-0" : ""}>
              <FormFieldRenderer
                field={{
                  ...nextField,
                  label: isInline
                    ? ""
                    : nextField.label.includes("normalized")
                      ? "Name (normalized)"
                      : nextField.label,
                }}
                value={formData[nextField.id]}
                onChange={(value) => onFieldChange(nextField.id, value)}
                disabled={disabled}
                validationError={validationErrors[nextField.id]}
              />
            </div>
          </div>
        </div>,
      );
      i++; // skip the paired field
    } else {
      elements.push(
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={formData[field.id]}
          onChange={(value) => onFieldChange(field.id, value)}
          disabled={disabled}
          validationError={validationErrors[field.id]}
        />,
      );
    }
  }

  return (
    <section className={sectionClass}>
      <HeadingTag className={headingClass}>{section.label}</HeadingTag>
      <div className="space-y-4">{elements}</div>
      {section.subsections?.map((sub) => (
        <FormSectionRenderer
          key={sub.id}
          section={sub}
          formData={formData}
          onFieldChange={onFieldChange}
          disabled={disabled}
          validationErrors={validationErrors}
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
  charterType,
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

  // Build section configs from the active tab
  const tabSections = useMemo(() => {
    if (!activeTabData) return [];
    if (activeTabData.sections) {
      return activeTabData.sections.map((s) => buildSectionConfig(s, schema));
    }
    return [];
  }, [activeTabData, schema]);

  // Build always-visible section configs
  const alwaysVisibleSections = useMemo(() => {
    return alwaysVisibleTabs.map((tab) => ({
      tab,
      sections: tab.sections
        ? tab.sections.map((s) => buildSectionConfig(s, schema))
        : tab.fields
          ? [{
              id: tab.id,
              label: tab.label,
              fields: tab.fields.map((f) => buildFieldConfig(f, schema)),
              applies_to: "all" as const,
            }]
          : [],
    }));
  }, [alwaysVisibleTabs, schema]);

  // Check if active tab is a special tab
  const isSpecialTab = activeTabData?.type === "special";

  return (
    <>
      {/* Always-visible sections (rendered above tabs) */}
      {alwaysVisibleSections.map(({ tab, sections }) =>
        sections.map((section) => (
          <div key={tab.id} className="mb-6">
            <FormSectionRenderer
              section={section}
              formData={formData}
              onFieldChange={onFieldChange}
              disabled={disabled}
              validationErrors={validationErrors}
              depth={0}
            />
          </div>
        )),
      )}

      {/* Tab bar */}
      {regularTabs.length > 0 && (
        <div className="border-b border-border">
          <div className="flex gap-0 -mb-px">
            {regularTabs.map((tab) => {
              let tabLabel = tab.label;
              if (tab.id === "formulary") tabLabel = "Formulary Analysis";
              else if (tab.id === "fulltext") tabLabel = "Full Text";
              else if (tab.id === "image") tabLabel = "Image";

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
        {!isSpecialTab && tabSections.length > 0 && (
          <div className="space-y-6">
            {tabSections.map((section) => (
              <FormSectionRenderer
                key={section.id}
                section={section}
                formData={formData}
                onFieldChange={onFieldChange}
                disabled={disabled}
                validationErrors={validationErrors}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
