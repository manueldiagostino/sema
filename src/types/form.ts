/** Input type for form fields. */
export type FieldInputType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "dynamic-list"
  | "choice";

/** Cardinality of a form field. */
export type FieldCardinality = "single" | "multiple";

/** A charter type definition in the type selector. */
export interface CharterTypeConfig {
  id: string;
  label: string;
  object_value: string;
  object_subtype_value?: string;
}

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
