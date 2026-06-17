/**
 * Schema Adapter — bridges the unified schema system to legacy UI types.
 *
 * This layer converts the new `TeiSchema` + view configs into the structures
 * that existing components consume (`ColumnConfig[]`, legacy card configs, etc.).
 *
 * The adapter is the migration path: components can adopt these adapters
 * one-by-one without a big-bang rewrite.
 */

import type {
  TeiElement,
  TableColumn,
  CardSection,
  CardField,
} from "@/types/schema";
import type { ColumnConfig } from "@/types/corpus";
import { loadTeiSchema } from "@/lib/schema/registry";
import {
  loadTableConfig,
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

  // Handle wrapper elements (e.g. ab wrapping persName, person wrapping persName)
  if (m.wrapper) {
    // Build the element with wrapper
    // e.g. tei:div[@type='protocol']/tei:ab[@type='invocatio']
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

    // Apply wrapper_attributes as element predicates when no wrapper is present
    // (handles the case where a field uses wrapper_attributes for filtering
    // but has no intermediate wrapper element, e.g. <ab type="invocatio">)
    if (m.wrapper_attributes) {
      const attrPreds: string[] = [];
      for (const [k, v] of Object.entries(m.wrapper_attributes)) {
        if (v === "*") {
          attrPreds.push(`@${k}`);
        } else {
          attrPreds.push(`@${k}='${v}'`);
        }
      }
      if (attrPreds.length > 0) {
        xpath += `[${attrPreds.join(" and ")}]`;
      }
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
