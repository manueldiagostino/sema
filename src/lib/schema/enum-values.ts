/**
 * Enum Value Serialization — shared utilities for multi-valued TEI attributes.
 *
 * TEI P5 uses space-separated NMTOKENS for multi-valued attributes (e.g.
 * `@subtype="symbolica verbalis"`). These utilities ensure consistent
 * serialization (array → string) and deserialization (string → array)
 * across all layers: XML building, XML parsing, corpus build, and display.
 */

/**
 * Serialize an array of enum values into a single TEI attribute string.
 * Multiple values are space-separated per TEI NMTOKENS convention.
 *
 * @example
 *   serializeEnumValues(["symbolica", "verbalis"])  // → "symbolica verbalis"
 *   serializeEnumValues(["dupli_pena"])              // → "dupli_pena"
 *   serializeEnumValues([])                           // → ""
 */
export function serializeEnumValues(values: string[]): string {
  return values.filter((v) => v.length > 0).join(" ");
}

/**
 * Deserialize a TEI attribute value into an array of individual enum values.
 * Splits on whitespace. Handles empty strings and whitespace-only inputs.
 *
 * @example
 *   deserializeEnumValues("symbolica verbalis")  // → ["symbolica", "verbalis"]
 *   deserializeEnumValues("dupli_pena")           // → ["dupli_pena"]
 *   deserializeEnumValues("")                     // → []
 */
export function deserializeEnumValues(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value.trim().split(/\s+/).filter(Boolean);
}
