/**
 * Schema-Driven TEI XML Serializer
 *
 * Converts form field values into TEI XML fragments based on TeiElement
 * schema mappings. Mirrors the approach of xmlParser.ts (which reads XML
 * via XPath and TeiElement definitions) for the write path.
 *
 * All serialization decisions come from the TeiElement schema:
 * - tei.element: the TEI tag name
 * - tei.type: the @type attribute value
 * - tei.attribute: which attribute carries the field value (enum → @subtype)
 * - tei.wrapper / tei.wrapper_attributes: outer container element + attrs
 * - type (ElementType): text, enum, date, entity, identifier, number, computed
 * - cardinality: single | multiple
 * - level_field.key: which object property maps to @subtype (entity case)
 * - exclusive_option.fieldKey: which boolean maps to @role (entity case)
 *
 * Returns: string[] — one string per TEI element fragment.
 * Empty/null values produce an empty array.
 */

import type { TeiElement, TeiMapping } from "@/types/schema";
import type { DateFieldValue, PlaceEntry, WitnessEntry } from "@/types/form";
import { serializeEnumValues } from "@/lib/schema/enum-values";

/** Escape special XML characters in text content and attribute values. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Check if a value is empty / null / blank string. */
function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Build an XML attribute string from a record. */
function attr(a?: Record<string, string>): string {
  if (!a) return "";
  return Object.entries(a)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
}

/**
 * Build the full attribute string for an element, combining:
 * - tei.type → @type attribute
 * - tei.attribute → the named attribute (e.g. @subtype) with the
 *   serialized value (for enum fields)
 * - wrapper_attributes (when no wrapper) → merged in
 * - any extra attributes passed in
 */
function buildAttrs(
  tei: TeiMapping,
  extra: Record<string, string> = {},
): string {
  const parts: Record<string, string> = {};

  // @type from tei.type
  if (tei.type) {
    parts.type = tei.type;
  }

  // When there's no wrapper, wrapper_attributes go directly on the element
  if (!tei.wrapper && tei.wrapper_attributes) {
    Object.assign(parts, tei.wrapper_attributes);
  }

  // Merge extra attributes
  Object.assign(parts, extra);

  return attr(parts);
}

/**
 * Build attributes for a wrapper element, using wrapper_attributes from
 * the TeiMapping plus any extra attributes.
 */
function buildWrapperAttrs(
  tei: TeiMapping,
  extra: Record<string, string> = {},
): string {
  const parts: Record<string, string> = {};

  // Copy wrapper_attributes
  if (tei.wrapper_attributes) {
    Object.assign(parts, tei.wrapper_attributes);
  }

  // Merge extra attributes
  Object.assign(parts, extra);

  return attr(parts);
}

/**
 * Serialize a single text-like value (text, identifier, number) into an
 * XML element with optional wrapper.
 */
function serializeTextLike(
  tei: TeiMapping,
  text: string,
  extraAttrs: Record<string, string> = {},
  extraContent: string = "",
): string {
  if (tei.wrapper) {
    // Inner element: @type from tei.type, but NOT extraAttrs (those go on wrapper)
    const elementAttrs = tei.type ? attr({ type: tei.type }) : "";
    const inner = `<${tei.element}${elementAttrs}>${esc(text)}${extraContent}</${tei.element}>`;

    // Wrapper: wrapper_attributes + extraAttrs
    const wrapperAttrs = buildWrapperAttrs(tei, extraAttrs);
    return `<${tei.wrapper}${wrapperAttrs}>${inner}</${tei.wrapper}>`;
  }

  // No wrapper: buildAttrs includes tei.type + wrapper_attributes + extra
  const elementAttrs = buildAttrs(tei, extraAttrs);
  return `<${tei.element}${elementAttrs}>${esc(text)}${extraContent}</${tei.element}>`;
}

/**
 * Serialize a date field value into a <date> element.
 */
function serializeDate(tei: TeiMapping, val: DateFieldValue): string {
  const attrs = buildAttrs(tei, val.iso ? { when: val.iso } : {});
  const text = val.text || val.iso || "";
  return `<${tei.element}${attrs}>${esc(text)}</${tei.element}>`;
}

/**
 * Serialize an enum field value. The enum keys are written to the attribute
 * named by tei.attribute (typically "subtype"). If pairedText is provided,
 * it becomes the element's text content.
 */
function serializeEnum(
  tei: TeiMapping,
  values: string[],
  pairedText?: string,
): string {
  const subtypeValue = serializeEnumValues(values);
  const subtypeAttr: Record<string, string> = {};
  if (tei.attribute && subtypeValue) {
    subtypeAttr[tei.attribute] = subtypeValue;
  }
  const text = pairedText ?? "";

  return serializeTextLike(tei, text, subtypeAttr);
}

/**
 * Serialize an entity with level_field into one XML element per entry.
 * Each entry gets @subtype from the level field value.
 */
function serializeEntityLevelField(
  tei: TeiMapping,
  entries: (PlaceEntry | WitnessEntry)[],
  levelKey: string,
): string[] {
  const results: string[] = [];
  for (const entry of entries) {
    if (isEmpty(entry.name)) continue;

    const subtype: Record<string, string> = {};
    const level = (entry as unknown as Record<string, unknown>)[levelKey];
    if (level && typeof level === "string" && level.trim()) {
      subtype.subtype = level.trim();
    }

    results.push(serializeTextLike(tei, entry.name, subtype));
  }
  return results;
}

/**
 * Serialize an entity with exclusive_option into one XML element per entry.
 * Each entry gets @role on the wrapper based on the exclusive option field.
 */
function serializeEntityExclusiveOption(
  tei: TeiMapping,
  entries: WitnessEntry[],
  fieldKey: string,
): string[] {
  const results: string[] = [];
  for (const entry of entries) {
    if (isEmpty(entry.name)) continue;

    const role = ((entry as unknown as Record<string, boolean>)[fieldKey]) ? "issuer" : "witness";
    results.push(serializeTextLike(tei, entry.name, { role }));
  }
  return results;
}

/**
 * Serialize a field value into an array of TEI XML fragment strings
 * based on the TeiElement schema mapping.
 *
 * @param elem - The TeiElement from schema.elements[fieldId]
 * @param value - The raw field value from FormSubmissionData.fields[fieldId]
 * @param options.pairedText - When part of a field_pair, the text from the
 *   paired text field (e.g. invocatio_text when serializing invocatio_analysis)
 *
 * @returns Array of TEI XML fragment strings. Empty array for missing/empty values.
 */
export function serializeFieldElements(
  elem: TeiElement,
  value: unknown,
  options?: { pairedText?: string },
): string[] {
  if (!elem || !elem.tei) return [];
  const tei = elem.tei;

  // Handle empty values
  if (isEmpty(value)) {
    // For enum with pairedText, still return empty if no value
    return [];
  }

  // ── Text / Identifier / Number ──────────────────────────────────────
  if (elem.type === "text" || elem.type === "identifier" || elem.type === "number") {
    const text = typeof value === "string" ? value : String(value ?? "");
    if (isEmpty(text)) return [];
    return [serializeTextLike(tei, text)];
  }

  // ── Date ────────────────────────────────────────────────────────────
  if (elem.type === "date") {
    if (typeof value === "object" && value !== null && "iso" in value) {
      const dv = value as DateFieldValue;
      if (isEmpty(dv.iso) && isEmpty(dv.text)) return [];
      return [serializeDate(tei, dv)];
    }
    // Fallback: treat as string
    const text = typeof value === "string" ? value : "";
    if (isEmpty(text)) return [];
    return [serializeDate(tei, { iso: text, text })];
  }

  // ── Enum ────────────────────────────────────────────────────────────
  if (elem.type === "enum") {
    // Normalize value to string array
    let enumValues: string[];
    if (Array.isArray(value)) {
      enumValues = value.filter((v): v is string => typeof v === "string");
    } else if (typeof value === "string") {
      enumValues = [value];
    } else {
      return [];
    }

    if (enumValues.length === 0) return [];

    const pairedText = options?.pairedText;
    if (elem.cardinality === "single") {
      // Single: just the enum value
      return [serializeEnum(tei, enumValues, pairedText)];
    } else {
      // Multiple: space-separated NMTOKENS in one element
      return [serializeEnum(tei, enumValues, pairedText)];
    }
  }

  // ── Entity ──────────────────────────────────────────────────────────
  if (elem.type === "entity") {
    // Entity values come as arrays of objects (WitnessEntry[] or PlaceEntry[])
    if (!Array.isArray(value)) return [];
    const entries = value.filter(
      (e): e is Record<string, unknown> =>
        typeof e === "object" && e !== null && "name" in e,
    );
    if (entries.length === 0) return [];

    // Level field serialization
    if (elem.level_field?.key) {
      return serializeEntityLevelField(tei, entries as unknown as PlaceEntry[], elem.level_field.key);
    }

    // Exclusive option serialization
    if (elem.exclusive_option?.fieldKey) {
      return serializeEntityExclusiveOption(tei, entries as unknown as WitnessEntry[], elem.exclusive_option.fieldKey);
    }

    // Default: serialize with just @type attribute
    const results: string[] = [];
    for (const entry of entries) {
      const name = entry.name as string | undefined;
      if (isEmpty(name)) continue;
      results.push(serializeTextLike(tei, name as string));
    }
    return results;
  }

  // ── Computed ────────────────────────────────────────────────────────
  if (elem.type === "computed") {
    return [];
  }

  // ── Unknown / Fallback ──────────────────────────────────────────────
  return [];
}
