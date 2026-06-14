/**
 * Unified TEI Schema — TypeScript type definitions.
 *
 * These types model the YAML-based schema system in `config/tei-schema/`
 * and `config/views/`. They are the single source of truth for element
 * definitions, entity mappings, and view configurations.
 */

// ══════════════════════════════════════════════════════════════════════════════
// TEI Schema (config/tei-schema/)
// ══════════════════════════════════════════════════════════════════════════════

/** Top-level schema for a charter type (merged from _base + overrides). */
export interface TeiSchema {
  namespace: string;
  prefix: string;
  elements: Record<string, TeiElement>;
  entities: Record<string, EntitySchema>;
  patterns?: PatternDefinition[];
}

/** A single TEI element definition. */
export interface TeiElement {
  id?: string;
  tei: TeiMapping;
  label: string;
  type: ElementType;
  cardinality: "single" | "multiple";
  formulary_section?: string;
  options?: Option[];
  default_value?: string;
  field_pair?: string;
  exclusive_option?: { label: string; fieldKey: string };
  level_field?: { key: string };
  sortable?: boolean;
  filterable?: boolean;
  truncate_words?: number;
  join?: string;
}

/** Mapping from a schema element to its TEI XML representation. */
export interface TeiMapping {
  element: string;
  type?: string;
  attribute?: string;
  text_source?: "element_text" | "attribute";
  wrapper?: string;
  wrapper_attributes?: Record<string, string>;
  xpath_parent: string;
}

/** Discriminator for element semantics. */
export type ElementType =
  | "identifier"
  | "text"
  | "date"
  | "enum"
  | "entity"
  | "computed"
  | "number";

/** A domain entity (person, place, institution). */
export interface EntitySchema {
  id?: string;
  label: string;
  tei_element: string;
  status: "placeholder" | "active";
  identifying_attribute: string;
  fields?: string[];
}

/** A pattern for dynamic/extensible TEI structures. */
export interface PatternDefinition {
  id?: string;
  match: string;
  label_template: string;
  type: ElementType;
  scope: "dynamic" | "custom";
  render_default: string;
  priority?: number;
}

/** Labelled value for enum fields. */
export interface Option {
  value: string;
  label: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Charter Type Overrides (config/tei-schema/charter-types/*.yaml)
// ══════════════════════════════════════════════════════════════════════════════

/** Raw charter-type YAML before merge (matches YAML structure). */
export interface CharterTypeSchema {
  charter_type: {
    label: string;
    object_value: string;
    object_subtype_value?: string;
    description?: string;
  };
  overrides?: Record<string, Partial<TeiElement>>;
  extensions?: Record<string, TeiElement>;
  valid_div_types?: string[];
  valid_note_types?: string[];
  formulary_sections?: {
    id: string;
    label: string;
    active: boolean;
    description?: string;
  }[];
  required_elements?: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// View Configs (config/views/)
// ══════════════════════════════════════════════════════════════════════════════

// ── Table ────────────────────────────────────────────────────────────────────

/** Top-level table view configuration. */
export interface TableViewConfig {
  columns: TableColumn[];
}

/** A single column in the corpus table. */
export interface TableColumn {
  id: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  render?: "badge" | "icon" | "text" | "edit-delete" | "textarea" | "date" | "link" | "dynamic-list";
  computed?: boolean;
  formula?: string;
  join?: string;
  truncate_words?: number;
}

// ── Card ─────────────────────────────────────────────────────────────────────

/** Document card view configuration. */
export interface CardViewConfig {
  header?: CardHeader;
  tabs?: CardTabConfig;
  postContent?: CardPostContent;
}

/** Card header (always visible). */
export interface CardHeader {
  title?: string;
  subtitle?: string;
  showRef?: boolean;
  sections?: CardHeaderSection[];
}

/** A group of fields in the card header. */
export interface CardHeaderSection {
  id: string;
  label: string;
  visibleWhen?: "any" | "all";
  fields: CardField[];
}

/** A single field reference in a card layout. */
export interface CardField {
  id: string;
  label?: string;
  truncate_words?: number;
  render?: string;
}

/** Tab container for the card. */
export interface CardTabConfig {
  defaultTab?: string;
  items: CardTab[];
}

/** A single tab in the card. */
export interface CardTab {
  id: string;
  label: string;
  type?: "always_visible" | "special";
  sections?: CardSection[];
  fields?: CardField[];
  status?: string;
}

/** A section within a card tab. */
export interface CardSection {
  id: string;
  label: string;
  visibleWhen?: "any" | "all";
  fields: CardField[];
  subsections?: CardSection[];
}

/** Content rendered below the card tabs. */
export interface CardPostContent {
  sections?: { id: string; label: string }[];
  citation?: {
    label: string;
    fields: { id: string; label: string }[];
  };
}

// ── Form ─────────────────────────────────────────────────────────────────────

/** Admin form view configuration. */
export interface FormViewConfig {
  charterType?: string;
  label?: string;
  tabs: FormTabConfig;
}

/** Tab container for the form. */
export interface FormTabConfig {
  defaultTab?: string;
  items: FormTab[];
}

/** A single tab in the form. */
export interface FormTab {
  id: string;
  label: string;
  type?: "always_visible" | "special";
  layout?: string;
  columns?: number;
  fields?: FormField[];
  sections?: FormSection[];
}

/** A section within a form tab. */
export interface FormSection {
  id: string;
  label: string;
  fields: FormField[];
  subsections?: FormSection[];
}

/** A single field in the form. */
export interface FormField {
  id: string;
  label?: string;
  input?: "text" | "textarea" | "date" | "select" | "radio" | "dynamic-list";
  field_pair?: string;
  default_value?: string;
  level_field?: { key: string };
  exclusive_option?: { label: string; fieldKey: string };
  options?: Option[];
  required?: boolean;
}

// ── Export ───────────────────────────────────────────────────────────────────

/** Export view configuration (PDF / TXT). */
export interface ExportViewConfig {
  sections: ExportSection[];
}

/** A section in the export layout. */
export interface ExportSection {
  id: string;
  label: string;
  type?: "special";
  fields: ExportField[];
}

/** A single field in an export section. */
export interface ExportField {
  id: string;
  label?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Base View Defaults (config/views/_base.yaml)
// ══════════════════════════════════════════════════════════════════════════════

/** Structure of config/views/_base.yaml. */
export interface BaseViewDefaults {
  defaults: {
    render: string;
    sortable: boolean;
    filterable: boolean;
    truncateWords: number;
    join: string;
    cardinality: string;
  };
  widths: Record<string, string | number>;
  badgeLabels: Record<string, Record<string, string>>;
  truncation: {
    table: { default: number };
    card: { default: number };
  };
  fieldGroups: Record<string, string[]>;
}
