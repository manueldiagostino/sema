import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import type {
  FormSectionsConfig,
  FormSectionConfig,
  FormFieldConfig,
  DateFieldValue,
  WitnessEntry,
} from "@/types/form";

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
function buildElementXPath(field: FormFieldConfig): string {
  let path = `//${field.xpath_parent}`;

  if (field.tei_wrapper) {
    // Wrapper element — narrow with wrapper_attributes if present
    if (field.tei_wrapper_attributes?.type) {
      path += `/tei:${field.tei_wrapper}[@type='${field.tei_wrapper_attributes.type}']`;
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
    for (const [key, value] of Object.entries(field.tei_attributes)) {
      predicates.push(`@${key}='${value}'`);
    }
  }

  if (!field.tei_wrapper && field.tei_wrapper_attributes) {
    for (const [key, value] of Object.entries(field.tei_wrapper_attributes)) {
      predicates.push(`@${key}='${value}'`);
    }
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
function buildWrapperXPath(field: FormFieldConfig): string {
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
function emptyDefault(field: FormFieldConfig): unknown {
  switch (field.input) {
    case "text":
    case "textarea":
      return field.cardinality === "multiple" ? ([] as string[]) : "";
    case "date":
      return { iso: "", text: "" } as DateFieldValue;
    case "radio":
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
 * the form-sections.yaml configuration.
 *
 * Uses config-driven reverse mapping: for every field in the config the
 * corresponding XPath is constructed, the matching nodes are selected from
 * the DOM, and values are extracted based on the field's input type.
 *
 * Error handling is forgiving — individual field failures are logged and
 * replaced with empty defaults; the function never throws.
 *
 * @param xml  Raw TEI P5 XML string
 * @param config  Parsed form-sections.yaml configuration
 * @returns Record keyed by field id with extracted values
 */
export function parseTeiXml(
  xml: string,
  config: FormSectionsConfig,
): Record<string, unknown> {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const select = xpath.useNamespaces({ tei: TEI_NS });

  const result: Record<string, unknown> = {};

  // ── Per-field extraction ────────────────────────────────────────────────

  function extractField(field: FormFieldConfig): void {
    try {
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
            const iso = el.getAttribute("when") || "";
            const rawText = getTextContent(nodes[0]).trim();
            // Don't duplicate the ISO value as display text
            result[field.id] = {
              iso,
              text: rawText === iso ? "" : rawText,
            } as DateFieldValue;
          } else {
            result[field.id] = { iso: "", text: "" } as DateFieldValue;
          }
          break;
        }

        // ── radio / select ───────────────────────────────────────────
        // Values are stored as the `subtype` attribute on the matched
        // TEI element.  For cardinality "multiple" the attribute may
        // contain space-separated values (e.g. "symbolica verbalis").
        case "radio":
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

  // ── Recursive section traversal ─────────────────────────────────────────

  function processSection(section: FormSectionConfig): void {
    for (const field of section.fields) {
      extractField(field);
    }
    if (section.subsections) {
      for (const sub of section.subsections) {
        processSection(sub);
      }
    }
  }

  for (const section of config.sections) {
    processSection(section);
  }

  // ── Full text (not config-driven; rendered in a separate form tab) ──
  try {
    const ftNodes = select(
      "//tei:text/tei:body/tei:div[@type='full_text']",
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
