/**
 * Schema Adapter — bridges the unified schema system to legacy UI types.
 *
 * This layer converts the new `TeiSchema` + view configs into the structures
 * that existing components consume (`ColumnConfig[]`, `FormSectionsConfig`, etc.).
 *
 * The adapter is the migration path: components can adopt these adapters
 * one-by-one without a big-bang rewrite.
 */

import type {
  TeiElement,
  TableViewConfig,
  TableColumn,
  FormViewConfig,
  FormTab,
  FormSection,
  FormField,
  CardViewConfig,
  CardTab,
  CardSection,
  CardField,
  ExportViewConfig,
  ExportSection,
} from "@/types/schema";
import type { ColumnConfig } from "@/types/corpus";
import type {
  FormSectionsConfig,
  FormSectionConfig,
  FormFieldConfig,
  CharterTypeConfig,
  FieldInputType,
  SelectOption,
} from "@/types/form";
import { loadTeiSchema, getElement } from "@/lib/schema/registry";
import {
  loadTableConfig,
  loadFormConfig,
  loadCardConfig,
  loadExportConfig,
} from "@/lib/schema/views";

// ══════════════════════════════════════════════════════════════════════════════
// TABLE ADAPTER → ColumnConfig[]
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build the XPath for a schema element.
 *
 * Reconstructs the full XPath from the `tei` mapping, including optional
 * wrapper elements, type/subtype attributes, and the attribute to read.
 */
export function buildXpath(elem: TeiElement): string {
  const m = elem.tei;
  // Guard: computed elements or empty TEI mappings have no XPath
  if (!m.xpath_parent || elem.type === "computed") {
    return "";
  }
  let xpath = m.xpath_parent;

  // Walk through the TEI element hierarchy
  const elementName = m.element;

  // Handle wrapper elements (e.g. diploPart wrapping p)
  if (m.wrapper) {
    // Build the element with wrapper
    // e.g. tei:div[@type='protocol']/tei:diploPart[@type='invocatio']
    const wrapperAttrs: string[] = [];
    if (m.wrapper_attributes) {
      for (const [k, v] of Object.entries(m.wrapper_attributes)) {
        if (v === "*") {
          wrapperAttrs.push(`@${k}`);
        } else {
          wrapperAttrs.push(`@${k}='${v}'`);
        }
      }
    }

    // Check if there are type attributes on the wrapper
    let wrapperFilter = "";
    if (wrapperAttrs.length > 0) {
      // Handle both single and compound filters
      // Some wrappers use compound predicates like [@type='dispositio' and @subtype]
      if (wrapperAttrs.some((a) => a.startsWith("@") && !a.includes("="))) {
        // Has an existence check — build compound predicate
        wrapperFilter = `[${wrapperAttrs.join(" and ")}]`;
      } else {
        wrapperFilter = `[${wrapperAttrs.join(" and ")}]`;
      }
    }

    xpath += `/tei:${m.wrapper}${wrapperFilter}`;

    // If the inner element is NOT the same as wrapper, add it
    if (elementName !== m.wrapper) {
      // For elements like "name" inside a wrapper
      if (m.type) {
        xpath += `/tei:${elementName}[@type='${m.type}']`;
      } else {
        xpath += `/tei:${elementName}`;
      }
    }
  } else {
    // No wrapper — direct element with optional type filter
    if (m.type) {
      // Compound type predicates — include attribute existence check when set
      if (m.attribute) {
        xpath += `/tei:${elementName}[@type='${m.type}' and @${m.attribute}]`;
      } else {
        xpath += `/tei:${elementName}[@type='${m.type}']`;
      }
    } else {
      xpath += `/tei:${elementName}`;
    }
  }

  return xpath;
}

/**
 * Convert a schema TableColumn + TeiElement into a legacy ColumnConfig.
 */
function tableColumnToLegacy(
  col: TableColumn,
  elem: TeiElement | undefined,
  baseDefaults: { sortable: boolean; filterable: boolean; join: string; truncateWords: number },
): ColumnConfig {
  // Compute the XPath
  let xpath: string;
  let attribute: string | undefined;

  if (elem) {
    // Check if the column is a computed column (formula-based or schema-defined)
    if (col.computed || col.formula || elem.type === "computed") {
      // Computed columns don't have a direct XPath — use a placeholder
      const formula = col.formula ?? elem.formula ?? "";
      xpath = formula ? `computed:${formula}` : `computed:${col.id}`;
    } else {
      xpath = buildXpath(elem);
      // Determine which attribute to read
      if (elem.tei.attribute) {
        attribute = elem.tei.attribute;
      }
    }
  } else {
    // No schema element — check if computed before falling back
    if (col.computed || col.formula) {
      const formula = col.formula ?? "";
      xpath = formula ? `computed:${formula}` : `computed:${col.id}`;
    } else {
      // Fallback XPath marker for fields not in schema
      xpath = `field:${col.id}`;
    }
  }

  return {
    id: col.id,
    label: elem?.label ?? col.id,
    xpath,
    attribute,
    sortable: col.sortable ?? baseDefaults.sortable,
    filterable: col.filterable ?? baseDefaults.filterable,
    cardinality:
      (elem?.cardinality as "single" | "multiple") ?? "single",
    join: elem?.join ?? baseDefaults.join,
    truncateWords:
      col.truncate_words ??
      (elem?.truncate_words ??
        (baseDefaults.truncateWords > 0 ? baseDefaults.truncateWords : undefined)),
  };
}

/**
 * Get legacy `ColumnConfig[]` for a table view variant.
 *
 * @param variant     "home" or "admin"
 * @param charterType  Optional charter type for schema merge
 */
export function getLegacyColumns(
  variant: "home" | "admin",
  charterType?: string,
): ColumnConfig[] {
  const schema = loadTeiSchema(charterType);
  const tableView = loadTableConfig(variant, charterType);

  // Load base defaults for fallback values
  const baseDefaults = {
    sortable: true,
    filterable: true,
    join: ", ",
    truncateWords: 0,
  };

  return tableView.columns.map((col) => {
    const elem = schema.elements[col.id];
    return tableColumnToLegacy(col, elem, baseDefaults);
  });
}

/**
 * Get simplified column config for DocumentCard (id + label + truncateWords).
 */
export function getLegacyCardColumns(
  charterType?: string,
): Array<{ id: string; label: string; truncateWords?: number }> {
  const schema = loadTeiSchema(charterType);
  return Object.entries(schema.elements)
    .filter(([, elem]) => elem.type !== "computed" || elem.id === "full_text")
    .map(([id, elem]) => ({
      id,
      label: elem.label,
      truncateWords: elem.truncate_words,
    }));
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM ADAPTER → FormSectionsConfig
// ══════════════════════════════════════════════════════════════════════════════

/** Map schema ElementType → legacy FieldInputType. */
function schemaTypeToInput(elem: TeiElement | undefined, formField?: FormField): FieldInputType {
  // Prefer the explicit input type from the form view config
  if (formField?.input) return formField.input;

  // Fall back to schema element type
  switch (elem?.type) {
    case "date":
      return "date";
    case "enum":
      return "radio";
    case "entity":
      return "dynamic-list";
    case "computed":
    case "identifier":
    case "number":
      return "text";
    case "text":
    default:
      return "text";
  }
}

/**
 * Convert a FormField + TeiElement into a legacy FormFieldConfig.
 */
function formFieldToLegacy(
  formField: FormField,
  elem: TeiElement | undefined,
): FormFieldConfig {
  const input = schemaTypeToInput(elem, formField);

  // Build the legacy TEI mapping from the schema element
  const teiElement = elem?.tei?.element ?? "";
  const teiAttributes: Record<string, string> = {};
  if (elem?.tei?.type) {
    teiAttributes.type = elem.tei.type;
  }

  // Determine cardinality
  const cardinality = elem?.cardinality === "multiple" ? "multiple" : "single";

  // Build xpath_parent
  const xpathParent = elem?.tei?.xpath_parent ?? "";

  // Handle wrapper element — if there's a wrapper, adjust xpath_parent
  if (elem?.tei?.wrapper) {
    // The form field's TEI element goes inside the wrapper
    // We keep xpath_parent pointing to the section div, and set tei_wrapper
  }

  return {
    id: formField.id,
    label: formField.label ?? elem?.label ?? formField.id,
    input,
    cardinality,
    tei_element: teiElement,
    tei_attributes: Object.keys(teiAttributes).length > 0 ? teiAttributes : undefined,
    tei_wrapper: elem?.tei?.wrapper,
    tei_wrapper_attributes: elem?.tei?.wrapper_attributes,
    xpath_parent: xpathParent,
    applies_to: "all", // Form view configs are already filtered by charter type
    required: formField.required,
    options: formField.options as SelectOption[] | undefined,
    default_value: formField.default_value ?? elem?.default_value,
    field_pair: formField.field_pair ?? elem?.field_pair,
    exclusive_option: formField.exclusive_option ?? elem?.exclusive_option,
    level_field: formField.level_field ?? elem?.level_field,
  };
}

/**
 * Recursively convert FormSection[] (from view config) + schema elements
 * into legacy FormSectionConfig[].
 */
function convertFormSections(
  sections: FormSection[],
  schema: ReturnType<typeof loadTeiSchema>,
): FormSectionConfig[] {
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    fields: section.fields.map((f) => {
      const elem = schema.elements[f.id];
      return formFieldToLegacy(f, elem);
    }),
    subsections: section.subsections
      ? convertFormSections(section.subsections, schema)
      : undefined,
    applies_to: "all" as const,
  }));
}

/**
 * Get legacy `FormSectionsConfig` for a charter type.
 *
 * @param charterType  Charter type ID (e.g. "instrumentum-venditionis")
 */
export function getLegacyFormSections(charterType: string): FormSectionsConfig {
  const schema = loadTeiSchema(charterType);
  const formView = loadFormConfig(charterType.replace(/_/g, "-"));

  // Build charter type config from the schema
  const charterTypeSchema =
    charterType === "instrumentum_venditionis"
      ? {
          id: "instrumentum_venditionis",
          label: "Instrumentum venditionis",
          object_value: "Instrumentum venditionis",
          object_subtype_value: "Venditio",
        }
      : {
          id: charterType.replace(/-/g, "_"),
          label: charterType
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          object_value: charterType
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        };

  const types: CharterTypeConfig[] = [charterTypeSchema as CharterTypeConfig];

  // Convert form view sections to legacy format
  const sections: FormSectionConfig[] = [];

  if (formView?.tabs?.items) {
    for (const tab of formView.tabs.items) {
      if (tab.type === "special") continue;

      if (tab.fields && tab.fields.length > 0) {
        // Tab-level fields (e.g. "properties" tab)
        sections.push({
          id: tab.id,
          label: tab.label,
          fields: tab.fields.map((f) => {
            const elem = schema.elements[f.id];
            return formFieldToLegacy(f, elem);
          }),
          applies_to: "all",
        });
      }

      if (tab.sections) {
        // Sections within a tab
        const tabSections = convertFormSections(tab.sections, schema);

        // If there's only one section with the same ID as the tab, flatten it
        if (
          tabSections.length === 1 &&
          tabSections[0].id === tab.id &&
          !tab.label
        ) {
          sections.push(tabSections[0]);
        } else {
          // Wrap in a parent section if there are multiple
          if (tabSections.length > 0) {
            sections.push({
              id: tab.id,
              label: tab.label,
              fields: [],
              subsections: tabSections,
              applies_to: "all",
            });
          }
        }
      }
    }
  }

  // Fallback: if no sections from view config, build from schema
  if (sections.length === 0) {
    const sectionOrder = ["metadata", "protocol", "contextus", "eschatocol"];
    const sectionLabels: Record<string, string> = {
      metadata: "Properties",
      protocol: "Protocol",
      contextus: "Text",
      eschatocol: "Eschatocol",
    };

    for (const sectionId of sectionOrder) {
      const elems = Object.entries(schema.elements)
        .filter(([, e]) => e.formulary_section === sectionId)
        .filter(([, e]) => e.type !== "computed");

      if (elems.length === 0) continue;

      sections.push({
        id: sectionId,
        label: sectionLabels[sectionId] ?? sectionId,
        fields: elems.map(([id, elem]) => ({
          id,
          label: elem.label,
          input: schemaTypeToInput(elem),
          cardinality: elem.cardinality === "multiple" ? "multiple" : "single",
          tei_element: elem.tei.element,
          tei_attributes: elem.tei.type ? { type: elem.tei.type } : undefined,
          tei_wrapper: elem.tei.wrapper,
          tei_wrapper_attributes: elem.tei.wrapper_attributes,
          xpath_parent: elem.tei.xpath_parent,
          applies_to: "all" as const,
          options: elem.options as SelectOption[] | undefined,
          default_value: elem.default_value,
          field_pair: elem.field_pair,
          exclusive_option: elem.exclusive_option,
          level_field: elem.level_field,
        })),
        applies_to: "all",
      });
    }
  }

  return { types, sections };
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD ADAPTER → DocumentCard-compatible structure
// ══════════════════════════════════════════════════════════════════════════════

/** Structure consumed by DocumentCard (simplified). */
export interface LegacyCardTab {
  id: string;
  label: string;
  type?: "always_visible" | "special";
  sections?: LegacyCardSection[];
  fields?: Array<{ id: string; label?: string; render?: string }>;
  status?: string;
}

export interface LegacyCardSection {
  id: string;
  label: string;
  visibleWhen?: "any" | "all";
  fields: Array<{ id: string; label?: string; render?: string }>;
  subsections?: LegacyCardSection[];
}

export interface LegacyCardConfig {
  header?: {
    title?: string;
    subtitle?: string;
    showRef?: boolean;
    sections?: LegacyCardSection[];
  };
  tabs?: LegacyCardTab[];
  postContent?: {
    sections?: { id: string; label: string }[];
    citation?: {
      label: string;
      fields: { id: string; label: string }[];
    };
  };
}

/**
 * Get legacy card configuration for DocumentCard.
 *
 * @param charterType  Optional charter type for override merge
 */
export function getLegacyCardTabs(
  charterType?: string,
): LegacyCardConfig {
  const schema = loadTeiSchema(charterType);
  const cardView = loadCardConfig(charterType);

  function enrichFields(
    fields: CardField[],
  ): Array<{ id: string; label?: string; render?: string }> {
    return fields.map((f) => ({
      id: f.id,
      label: f.label ?? schema.elements[f.id]?.label,
      render: f.render,
    }));
  }

  function enrichSections(
    sections?: CardSection[],
  ): LegacyCardSection[] | undefined {
    if (!sections) return undefined;
    return sections.map((s) => ({
      id: s.id,
      label: s.label,
      visibleWhen: s.visibleWhen,
      fields: enrichFields(s.fields),
      subsections: enrichSections(s.subsections),
    }));
  }

  return {
    header: cardView.header
      ? {
          title: cardView.header.title,
          subtitle: cardView.header.subtitle,
          showRef: cardView.header.showRef,
          sections: enrichSections(cardView.header.sections),
        }
      : undefined,
    tabs: cardView.tabs?.items.map((tab) => ({
      id: tab.id,
      label: tab.label,
      type: tab.type,
      status: tab.status,
      sections: enrichSections(tab.sections),
      fields: tab.fields ? enrichFields(tab.fields) : undefined,
    })),
    postContent: cardView.postContent,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT ADAPTER → xmlBuilder-compatible structure
// ══════════════════════════════════════════════════════════════════════════════

/** Structure consumed by xmlBuilder / export components. */
export interface LegacyExportSection {
  id: string;
  label: string;
  type?: "special";
  fields: Array<{ id: string; label?: string }>;
}

/**
 * Get legacy export sections for PDF/TXT export.
 *
 * @param charterType  Optional charter type for override merge
 */
export function getLegacyExportSections(
  charterType?: string,
): LegacyExportSection[] {
  const schema = loadTeiSchema(charterType);
  const exportView = loadExportConfig(charterType);

  return exportView.sections.map((section) => ({
    id: section.id,
    label: section.label,
    type: section.type,
    fields: section.fields.map((f) => ({
      id: f.id,
      label: f.label ?? schema.elements[f.id]?.label,
    })),
  }));
}
