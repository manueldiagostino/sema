/**
 * TEI Schema Registry — loads and caches the unified schema.
 *
 * Merge strategy:
 *   1. Load `config/tei-schema/_base.yaml`   → base schema
 *   2. Load `config/tei-schema/_patterns.yaml` → append patterns
 *   3. Optionally load `config/tei-schema/charter-types/<type>.yaml`
 *      → apply element-level overrides, then add extensions
 *
 * Results are cached in memory after the first load per charter type.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";
import type {
  TeiSchema,
  TeiElement,
  EntitySchema,
  PatternDefinition,
  CharterTypeSchema,
} from "@/types/schema";

// ── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, TeiSchema>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function configPath(...segments: string[]): string {
  return join(process.cwd(), "config", "tei-schema", ...segments);
}

function loadYamlFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  return load(raw) as Record<string, unknown>;
}

/**
 * Deep-merge two objects. `override` wins on conflict.
 * Arrays are replaced, not concatenated. Nested objects are merged recursively.
 */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overVal = override[key];
    if (
      baseVal &&
      overVal &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      typeof overVal === "object" &&
      !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }
  return result;
}

/**
 * Merge two element records. Charter-type elements override base elements
 * with the same ID, and new extensions are added.
 */
function mergeElements(
  base: Record<string, TeiElement>,
  override?: Record<string, Partial<TeiElement>>,
  extensions?: Record<string, TeiElement>,
): Record<string, TeiElement> {
  const result = { ...base };

  // Apply overrides (deep merge per element)
  if (override) {
    for (const [id, patch] of Object.entries(override)) {
      if (result[id]) {
        result[id] = deepMerge(result[id] as unknown as Record<string, unknown>, patch as unknown as Record<string, unknown>) as unknown as TeiElement;
      } else {
        // Override for an element not in base — treat as extension
        result[id] = patch as unknown as TeiElement;
      }
    }
  }

  // Add extensions
  if (extensions) {
    for (const [id, elem] of Object.entries(extensions)) {
      result[id] = elem;
    }
  }

  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the merged TEI schema for a charter type.
 *
 * @param charterType  Optional charter type ID (e.g. "instrumentum-venditionis").
 *                     If omitted, returns the base schema without charter-specific
 *                     overrides or extensions.
 * @returns The merged TeiSchema, cached in memory.
 */
export function loadTeiSchema(charterType?: string): TeiSchema {
  const cacheKey = charterType ?? "__base__";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1. Load base schema
  const basePath = configPath("_base.yaml");
  const baseRaw = loadYamlFile(basePath);
  if (!baseRaw) {
    throw new Error(`[schema/registry] Cannot load base schema: ${basePath}`);
  }

  const schema: TeiSchema = {
    namespace: (baseRaw.namespace as string) ?? "http://www.tei-c.org/ns/1.0",
    prefix: (baseRaw.prefix as string) ?? "tei",
    elements: (baseRaw.elements as Record<string, TeiElement>) ?? {},
    entities: (baseRaw.entities as Record<string, EntitySchema>) ?? {},
    patterns: [],
  };

  // 2. Load patterns
  const patternsPath = configPath("_patterns.yaml");
  const patternsRaw = loadYamlFile(patternsPath);
  if (patternsRaw?.patterns) {
    const patternsRecord = patternsRaw.patterns as Record<
      string,
      Omit<PatternDefinition, "id"> & Record<string, unknown>
    >;
    schema.patterns = Object.entries(patternsRecord).map(
      ([id, def]): PatternDefinition => ({
        id,
        match: def.match ?? "",
        label_template: def.label_template ?? "",
        type: def.type ?? "text",
        scope: def.scope ?? "dynamic",
        render_default: def.render_default ?? "text",
        priority: def.priority,
      }),
    );
  }

  // 3. Optionally apply charter-type overrides
  if (charterType) {
    const charterPath = configPath("charter-types", `${charterType}.yaml`);
    const charterRaw = loadYamlFile(charterPath);

    if (charterRaw) {
      const charter = charterRaw as unknown as CharterTypeSchema;

      // Merge elements: overrides + extensions
      schema.elements = mergeElements(
        schema.elements,
        charter.overrides,
        charter.extensions,
      );

      // Merge entities (charter-type entities would override base)
      // Currently no charter-type entities, but the mechanism is in place.
    }
  }

  // Assign IDs to elements (key = element ID)
  for (const [id, elem] of Object.entries(schema.elements)) {
    elem.id = id;
  }

  // Assign IDs to entities
  for (const [id, entity] of Object.entries(schema.entities)) {
    entity.id = id;
  }

  cache.set(cacheKey, schema);
  return schema;
}

/**
 * Look up a single element by its ID.
 *
 * @param id        Element ID (e.g. "intitulatio_text")
 * @param charterType  Optional charter type for merged lookup
 * @returns The TeiElement, or undefined if not found.
 */
export function getElement(
  id: string,
  charterType?: string,
): TeiElement | undefined {
  const schema = loadTeiSchema(charterType);
  return schema.elements[id];
}

/**
 * Return all elements belonging to a given formulary section.
 *
 * @param section   Section ID: "protocol" | "contextus" | "eschatocol" | "metadata"
 * @param charterType  Optional charter type for merged lookup
 * @returns Array of [id, TeiElement] pairs.
 */
export function getElementsBySection(
  section: string,
  charterType?: string,
): Array<[string, TeiElement]> {
  const schema = loadTeiSchema(charterType);
  return Object.entries(schema.elements).filter(
    ([, elem]) => elem.formulary_section === section,
  );
}

/**
 * Look up an entity schema by type name.
 *
 * @param type      Entity type (e.g. "person", "place")
 * @param charterType  Optional charter type for merged lookup
 * @returns The EntitySchema, or undefined if not found.
 */
export function getEntity(
  type: string,
  charterType?: string,
): EntitySchema | undefined {
  const schema = loadTeiSchema(charterType);
  return schema.entities[type];
}

/**
 * Return all available charter types by scanning the charter-types directory.
 *
 * Each charter-type YAML must have a `charter_type` block with at least `label`.
 * The ID is derived from the filename (hyphens → underscores).
 *
 * @returns Array of charter type metadata objects.
 */
export function getCharterTypes(): Array<{
  id: string;
  label: string;
  object_value?: string;
  object_subtype_value?: string;
}> {
  const charterTypesDir = configPath("charter-types");
  if (!existsSync(charterTypesDir)) return [];

  const files = readdirSync(charterTypesDir).filter((f) => f.endsWith(".yaml"));
  const types: Array<{
    id: string;
    label: string;
    object_value?: string;
    object_subtype_value?: string;
  }> = [];

  for (const file of files) {
    const id = file.replace(".yaml", "").replace(/-/g, "_");
    const raw = loadYamlFile(join(charterTypesDir, file));
    if (raw?.charter_type) {
      const ct = raw.charter_type as Record<string, unknown>;
      types.push({
        id,
        label: ct.label as string,
        object_value: ct.object_value as string | undefined,
        object_subtype_value: ct.object_subtype_value as string | undefined,
      });
    }
  }

  return types;
}

/**
 * Reset the schema cache. Useful during development or testing.
 */
export function clearSchemaCache(): void {
  cache.clear();
}
