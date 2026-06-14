/** Input type for form fields. */
export type FieldInputType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "dynamic-list"
  | "radio";

/** Cardinality of a form field. */
export type FieldCardinality = "single" | "multiple";

/** A charter type definition in the type selector. */
export interface CharterTypeConfig {
  id: string;
  label: string;
  object_value: string;
  object_subtype_value?: string;
}

/** Key-value attribute pair for TEI elements. */
export type TeiAttributes = Record<string, string>;

/** A single option for select fields. */
export interface SelectOption {
  value: string;
  label: string;
}

/** Default values that vary by charter type. */
export type DefaultByType = Record<string, string>;

/** A witness entry with an optional investitor flag. */
export interface WitnessEntry {
  name: string;
  is_investitor: boolean;
}

/** A place entry with name and granularity level. */
export interface PlaceEntry {
  name: string;
  level: string;
}

/** Configuration for a per-entry level field on dynamic lists. */
export interface LevelFieldConfig {
  key: string;
  label?: string;
}

/** Configuration for an exclusive option (radio) per dynamic list entry. */
export interface ExclusiveOptionConfig {
  label: string;
  fieldKey: string;
}

/** Definition of a single form field. */
export interface FormFieldConfig {
  /** Machine name — used as key in form data payload. */
  id: string;
  /** Display label in the form. */
  label: string;
  /** Input widget type. */
  input: FieldInputType;
  /** Single value or repeatable list. */
  cardinality: FieldCardinality;
  /** TEI element name to create (e.g. "title", "term", "name"). */
  tei_element: string;
  /** Optional attributes on the TEI element (e.g. { type: "object" }). */
  tei_attributes?: TeiAttributes;
  /** Optional intermediate wrapper element (e.g. "witness" wraps "name" for witnesses). */
  tei_wrapper?: string;
  /** Optional attributes on the wrapper element (e.g. { type: "price_clause" }). */
  tei_wrapper_attributes?: TeiAttributes;
  /** Full XPath to the parent element where this field's element lives. */
  xpath_parent: string;
  /** Which charter types show this field ("all" or list of type IDs). */
  applies_to: "all" | string[];
  /** Whether the field is required for submission. */
  required?: boolean;
  /** Options for select fields. */
  options?: SelectOption[];
  /** Default value (same for all charter types). */
  default_value?: string;
  /** Default values keyed by charter type ID. */
  default_by_type?: DefaultByType;
  /** Developer note (not shown in the UI). */
  note?: string;
  /** Groups this field with adjacent fields sharing the same pair ID (for descriptive + normalized pairs). */
  field_pair?: string;
  /** Exclusive radio option config for dynamic list entries (e.g. investitor flag). */
  exclusive_option?: ExclusiveOptionConfig;
  level_field?: LevelFieldConfig;
}

/** A section groups related fields under a common label. */
export interface FormSectionConfig {
  /** Machine name for the section. */
  id: string;
  /** Display label (rendered as a heading). */
  label: string;
  /** Fields in this section, rendered in order. */
  fields: FormFieldConfig[];
  /** Nested subsections (recursive). */
  subsections?: FormSectionConfig[];
  /** Which charter types show this section ("all" or list of type IDs). */
  applies_to: "all" | string[];
}

/** Top-level form configuration. */
export interface FormSectionsConfig {
  /** Charter type definitions for the type selector dropdown. */
  types: CharterTypeConfig[];
  /** Form sections, rendered in order. */
  sections: FormSectionConfig[];
}

/** A single date field value with both ISO and display text. */
export interface DateFieldValue {
  iso: string;
  text: string;
}

/** Key-value pair from the ad-hoc custom properties section. */
export interface AdHocField {
  key: string;
  value: string;
}

/** The form data payload sent to the API route on submission. */
export interface FormSubmissionData {
  /** Selected charter type ID (e.g. "emphyteusis"). */
  charter_type: string;
  /** Values for canonical and type-specific fields, keyed by field id. */
  fields: Record<string, string | string[] | DateFieldValue | WitnessEntry[] | PlaceEntry[] | undefined>;
  /** Ad-hoc custom properties added at the bottom of the form. */
  ad_hoc: AdHocField[];
}
