import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import type { DateFieldValue, WitnessEntry, PlaceEntry } from "@/types/form";
import type { FormViewConfig, TeiSchema, FormField } from "@/types/schema";

// ---------------------------------------------------------------------------
// Internal extraction config — replaces FormFieldConfig for XML parsing
// ---------------------------------------------------------------------------

/** Flat field config used by the XML extraction logic. */
interface ExtractionFieldConfig {
  id: string;
  input?: string;
  cardinality?: string;
  xpath_parent?: string;
  tei_wrapper?: string;
  tei_wrapper_attributes?: Record<string, string>;
  tei_element?: string;
  tei_attributes?: Record<string, string>;
  options?: Array<{ value: string; label: string }>;
  exclusive_option?: { label: string; fieldKey: string } | { value: string; label: string };
}

const TEI_NS = "http://www.tei-c.org/ns/1.0";

/** Collect all child nodes of a DOM node (avoids NodeListOf type issues). */
function getChildNodes(node: Node): Node[] {
  const children: Node[] = [];
  let child = node.firstChild;
  while (child) {
    children.push(child);
    child = child.nextSibling;
  }
  return children;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract text content from a DOM node.
 * Mirrors extractText() in scripts/build-corpus.ts.
 */
function getTextContent(node: Node): string {
  if (node.nodeType === 3) {
    // Text node
    return node.nodeValue || "";
  }
  return Array.from(getChildNodes(node))
    .map(getTextContent)
    .filter((t) => t.trim().length > 0)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Config builder — converts FormViewConfig + TeiSchema → ExtractionFieldConfig[]
// ---------------------------------------------------------------------------

/**
 * Build a flat array of extraction field configs from the view config and schema.
 *
 * Iterates all form tabs → sections → fields (and recursive subsections),
 * looks up each field's TEI mapping from the schema, and produces a flat list
 * of `ExtractionFieldConfig` objects consumed by the XML extraction logic.
 */
function buildExtractionConfig(
  formConfig: FormViewConfig,
  schema: TeiSchema,
): ExtractionFieldConfig[] {
  const configs: ExtractionFieldConfig[] = [];

  function addField(field: FormField): void {
    const element = schema.elements[field.id];

    // Determine input type: prefer form field override, then schema element type
    const input = field.input ?? element?.type;

    // Build tei_attributes from the schema element's type and attribute
    const teiAttributes: Record<string, string> | undefined = (() => {
      const attrs: Record<string, string> = {};
      if (element?.tei?.type) {
        attrs.type = element.tei.type;
      }
      if (element?.tei?.attribute) {
        attrs[element.tei.attribute] = "*";
      }
      return Object.keys(attrs).length > 0 ? attrs : undefined;
    })();

    configs.push({
      id: field.id,
      input,
      cardinality: element?.cardinality,
      xpath_parent: element?.tei?.xpath_parent,
      tei_element: element?.tei?.element,
      tei_wrapper: element?.tei?.wrapper,
      tei_wrapper_attributes: element?.tei?.wrapper_attributes,
      tei_attributes: teiAttributes,
      options: field.options ?? element?.options,
      exclusive_option: field.exclusive_option ?? element?.exclusive_option,
    });
  }

  function addSection(section: { fields: FormField[]; subsections?: unknown[] }): void {
    for (const field of section.fields) {
      addField(field);
    }
    if (section.subsections) {
      for (const sub of section.subsections) {
        addSection(sub as { fields: FormField[]; subsections?: unknown[] });
      }
    }
  }

  for (const tab of formConfig.tabs.items) {
    // Tab-level fields (e.g. "properties" tab)
    if (tab.fields) {
      for (const field of tab.fields) {
        addField(field);
      }
    }
    // Sections within the tab
    if (tab.sections) {
      for (const section of tab.sections) {
        addSection(section);
      }
    }
  }

  return configs;
}

// ---------------------------------------------------------------------------
// XPath helpers
// ---------------------------------------------------------------------------

/**
 * Build an XPath expression that selects the field's TEI element.
 *
 * Strategy:
 *  1. Start with `//` + xpath_parent
 *  2. If tei_wrapper exists, append it (with tei_wrapper_attributes as predicates)
 *  3. Append tei_element
 *  4. If NO wrapper but tei_wrapper_attributes exist, apply them as predicates
 *     on the tei_element itself
 *  5. Apply tei_attributes as predicates on tei_element
 */
/**
 * Build attribute predicates for XPath.
 * A value of "*" is treated as a presence check: `@attr` (not `@attr='*'`).
 * All other values produce `@attr='value'`.
 */
function buildPredicates(attrs: Record<string, string>): string[] {
  return Object.entries(attrs).map(([k, v]) =>
    v === "*" ? `@${k}` : `@${k}='${v}'`
  );
}

function buildElementXPath(field: ExtractionFieldConfig): string {
  let path = `//${field.xpath_parent}`;

  if (field.tei_wrapper) {
    // Wrapper element — narrow with ALL wrapper_attributes if present
    if (field.tei_wrapper_attributes) {
      const wrapperPreds = buildPredicates(field.tei_wrapper_attributes);
      if (wrapperPreds.length > 0) {
        path += `/tei:${field.tei_wrapper}[${wrapperPreds.join(" and ")}]`;
      } else {
        path += `/tei:${field.tei_wrapper}`;
      }
    } else {
      path += `/tei:${field.tei_wrapper}`;
    }
    path += `/tei:${field.tei_element}`;
  } else {
    path += `/tei:${field.tei_element}`;
  }

  // Collect predicates for tei_attributes and (when no wrapper) wrapper_attributes
  const predicates: string[] = [];

  if (field.tei_attributes) {
    predicates.push(...buildPredicates(field.tei_attributes));
  }

  if (!field.tei_wrapper && field.tei_wrapper_attributes) {
    predicates.push(...buildPredicates(field.tei_wrapper_attributes));
  }

  if (predicates.length > 0) {
    path += `[${predicates.join(" and ")}]`;
  }

  return path;
}

/**
 * Build an XPath that selects wrapper elements for dynamic-list fields.
 * Selects all repeating wrappers under xpath_parent (without the child element).
 */
function buildWrapperXPath(field: ExtractionFieldConfig): string {
  let path = `//${field.xpath_parent}`;
  if (field.tei_wrapper) {
    path += `/tei:${field.tei_wrapper}`;
  }
  return path;
}

/**
 * Return the empty default value appropriate for the field's input type
 * and cardinality.  Used when extraction fails or finds nothing.
 */
function emptyDefault(field: ExtractionFieldConfig): unknown {
  switch (field.input) {
    case "text":
    case "textarea":
      return field.cardinality === "multiple" ? ([] as string[]) : "";
    case "date":
      return { iso: "", text: "" } as DateFieldValue;
    case "choice":
    case "select":
      return field.cardinality === "multiple" ? ([] as string[]) : "";
    case "dynamic-list":
      return [] as WitnessEntry[];
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse a TEI XML document and extract form field values according to
 * the FormViewConfig + TeiSchema configuration.
 *
 * Uses config-driven reverse mapping: for every field in the config the
 * corresponding XPath is constructed, the matching nodes are selected from
 * the DOM, and values are extracted based on the field's input type.
 *
 * Error handling is forgiving — individual field failures are logged and
 * replaced with empty defaults; the function never throws.
 *
 * @param xml  Raw TEI P5 XML string
 * @param formConfig  Engine-native form view configuration
 * @param schema  TEI schema with element definitions and TEI mappings
 * @returns Record keyed by field id with extracted values
 */
export function parseTeiXml(
  xml: string,
  formConfig: FormViewConfig,
  schema: TeiSchema,
): Record<string, unknown> {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const select = xpath.useNamespaces({ tei: TEI_NS });

  const result: Record<string, unknown> = {};

  // Build flat extraction configs from the view config + schema
  const extractionConfigs = buildExtractionConfig(formConfig, schema);

  // ── Per-field extraction ────────────────────────────────────────────────

  function extractField(field: ExtractionFieldConfig): void {
    try {
      // ── Special case: datatio_topica_analysis is PlaceEntry[] ─────
      if (field.id === "datatio_topica_analysis") {
        const termNodes = select(
          "//tei:teiHeader//tei:term[@type='datatio_topica_analysis']",
          doc,
        ) as Node[];
        const entries: PlaceEntry[] = [];
        for (const node of termNodes) {
          const el = node as unknown as Element;
          const name = getTextContent(node).trim();
          const level = el.getAttribute("subtype") || "";
          if (name) {
            entries.push({ name, level });
          }
        }
        result[field.id] = entries;
        return;
      }

      switch (field.input) {
        // ── text / textarea ──────────────────────────────────────────
        case "text":
        case "textarea": {
          const nodes = select(buildElementXPath(field), doc) as Node[];
          if (field.cardinality === "multiple") {
            result[field.id] = nodes
              .map((n) => getTextContent(n).trim())
              .filter((t) => t.length > 0);
          } else {
            result[field.id] =
              nodes.length > 0 ? getTextContent(nodes[0]).trim() : "";
          }
          break;
        }

        // ── date ─────────────────────────────────────────────────────
        case "date": {
          const nodes = select(buildElementXPath(field), doc) as Node[];
          if (nodes.length > 0) {
            const el = nodes[0] as unknown as Element;
            result[field.id] = { iso: el.getAttribute("when") || "", text: "" } as DateFieldValue;
          } else {
            result[field.id] = { iso: "", text: "" } as DateFieldValue;
          }
          break;
        }

        // ── choice / select ──────────────────────────────────────────
        // Values are stored as the `subtype` attribute on the matched
        // TEI element.  For cardinality "multiple" the attribute may
        // contain space-separated values (e.g. "symbolica verbalis").
        case "choice":
        case "select": {
          const options = field.options || [];
          const nodes = select(buildElementXPath(field), doc) as Node[];

          const matchedValues: string[] = [];
          for (const node of nodes) {
            const subtype =
              ((node as unknown as Element).getAttribute("subtype")) || "";
            if (!subtype) continue;

            const parts = subtype.split(/\s+/);
            for (const part of parts) {
              const match = options.find(
                (o) => o.value === part || o.label === part,
              );
              if (match) {
                matchedValues.push(match.value);
              }
            }
          }

          if (field.cardinality === "multiple") {
            result[field.id] = [...new Set(matchedValues)];
          } else {
            result[field.id] =
              matchedValues.length > 0 ? matchedValues[0] : "";
          }
          break;
        }

        // ── dynamic-list (e.g. witness names) ────────────────────────
        // Selects the repeating wrapper elements, then for each wrapper
        // extracts the tei_element child text as `name` and checks the
        // `@ana` attribute for the exclusive_option flag.
        case "dynamic-list": {
          const wrapperNodes = select(
            buildWrapperXPath(field),
            doc,
          ) as Node[];
          const entries: WitnessEntry[] = [];

          for (const wrapperNode of wrapperNodes) {
            const childNodes = select(
              `./tei:${field.tei_element}`,
              wrapperNode,
            ) as Node[];
            const name =
              childNodes.length > 0
                ? getTextContent(childNodes[0]).trim()
                : "";

            if (!name) continue;

            // Check exclusive_option flag (e.g. ana="#investitor" on <witness>)
            let isExclusive = false;
            if (field.exclusive_option) {
              const ana =
                ((wrapperNode as unknown as Element).getAttribute("ana")) || "";
              isExclusive = ana.includes("#investitor");
            }

            entries.push({ name, is_investitor: isExclusive });
          }

          result[field.id] = entries;
          break;
        }

        // ── fallback ─────────────────────────────────────────────────
        default: {
          const nodes = select(buildElementXPath(field), doc) as Node[];
          result[field.id] =
            nodes.length > 0 ? getTextContent(nodes[0]).trim() : "";
        }
      }
    } catch (err) {
      console.warn(
        `[xmlParser] Error parsing field "${field.id}":`,
        err instanceof Error ? err.message : err,
      );
      result[field.id] = emptyDefault(field);
    }
  }

  // ── Iterate flat extraction configs ─────────────────────────────────────

  for (const config of extractionConfigs) {
    extractField(config);
  }

  // ── Full text (not config-driven; rendered in a separate form tab) ──
  try {
    const ftNodes = select(
      "//tei:text/tei:body/tei:diploPart[@type='full_text']",
      doc,
    ) as Node[];
    result.full_text =
      ftNodes.length > 0 ? getTextContent(ftNodes[0]).trim() : "";
  } catch (err) {
    console.warn(
      "[xmlParser] Error parsing full_text:",
      err instanceof Error ? err.message : err,
    );
    result.full_text = "";
  }

  return result;
}
