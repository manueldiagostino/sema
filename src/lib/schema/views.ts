/**
 * View Configuration Loader — loads and merges YAML view configs.
 *
 * Merge strategy for each view type:
 *   1. Load `config/views/_base.yaml`         → base defaults
 *   2. Load the specific view file (e.g. `table-home.yaml`)
 *   3. Optionally load `config/views/charter-types/<type>/<view>.yaml`
 *      → override specific properties
 *
 * Results are cached in memory after the first load.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";
import type {
  TableViewConfig,
  CardViewConfig,
  FormViewConfig,
  ExportViewConfig,
  BaseViewDefaults,
} from "@/types/schema";

// ── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, unknown>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function viewsPath(...segments: string[]): string {
  return join(process.cwd(), "config", "views", ...segments);
}

function loadYamlFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  return load(raw) as Record<string, unknown>;
}

/**
 * Deep-merge two objects. `override` wins on conflict.
 * Arrays are replaced entirely (not concatenated).
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

// ── Base View Defaults ───────────────────────────────────────────────────────

let baseDefaultsCache: BaseViewDefaults | null = null;

function loadBaseDefaults(): BaseViewDefaults {
  if (baseDefaultsCache) return baseDefaultsCache;

  const raw = loadYamlFile(viewsPath("_base.yaml"));
  if (!raw) {
    throw new Error("[schema/views] Cannot load config/views/_base.yaml");
  }

  baseDefaultsCache = raw as unknown as BaseViewDefaults;
  return baseDefaultsCache;
}

// ── Table Views ──────────────────────────────────────────────────────────────

/**
 * Load a table view configuration.
 *
 * @param variant     View variant: "home" or "admin"
 * @param charterType  Optional charter type for override merge
 */
export function loadTableConfig(
  variant: "home" | "admin",
  charterType?: string,
): TableViewConfig {
  const cacheKey = `table:${variant}:${charterType ?? "__default__"}`;
  const cached = cache.get(cacheKey) as TableViewConfig | undefined;
  if (cached) return cached;

  const viewRaw = loadYamlFile(viewsPath(`table-${variant}.yaml`));
  if (!viewRaw) {
    throw new Error(
      `[schema/views] Cannot load table view: table-${variant}.yaml`,
    );
  }

  let config: TableViewConfig = {
    defaultVisible: viewRaw.defaultVisible as TableViewConfig["defaultVisible"],
    columns: (viewRaw.columns as TableViewConfig["columns"]) ?? [],
  };

  // Apply charter-type overrides if present
  if (charterType) {
    const overridePath = viewsPath(
      "charter-types",
      charterType,
      `table-${variant}.yaml`,
    );
    const overrideRaw = loadYamlFile(overridePath);
    if (overrideRaw) {
      config = deepMerge(
        config as unknown as Record<string, unknown>,
        overrideRaw,
      ) as unknown as TableViewConfig;
    }
  }

  cache.set(cacheKey, config);
  return config;
}

// ── Card Views ───────────────────────────────────────────────────────────────

/**
 * Load a card view configuration.
 *
 * @param charterType  Optional charter type for override merge
 */
export function loadCardConfig(charterType?: string): CardViewConfig {
  const cacheKey = `card:${charterType ?? "__default__"}`;
  const cached = cache.get(cacheKey) as CardViewConfig | undefined;
  if (cached) return cached;

  const viewRaw = loadYamlFile(viewsPath("card.yaml"));
  if (!viewRaw) {
    throw new Error("[schema/views] Cannot load card.yaml");
  }

  let config: CardViewConfig = {
    header: viewRaw.header as CardViewConfig["header"],
    tabs: viewRaw.tabs as CardViewConfig["tabs"],
    postContent: viewRaw.postContent as CardViewConfig["postContent"],
  };

  // Apply charter-type overrides
  if (charterType) {
    const overridePath = viewsPath("charter-types", charterType, "card.yaml");
    const overrideRaw = loadYamlFile(overridePath);
    if (overrideRaw) {
      config = deepMerge(
        config as unknown as Record<string, unknown>,
        overrideRaw,
      ) as unknown as CardViewConfig;
    }
  }

  cache.set(cacheKey, config);
  return config;
}

// ── Form Views ───────────────────────────────────────────────────────────────

/**
 * Merge two tabs arrays by id. Per-type tabs override base tabs with the same id.
 * Tabs from the per-type config appear first (in order), followed by any
 * remaining base tabs not overridden.
 */
function mergeTabArrays(
  baseItems: Array<Record<string, unknown>>,
  overrideItems: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();

  // Start with base tabs
  for (const tab of baseItems) {
    const id = tab.id as string;
    if (id) merged.set(id, tab);
  }

  // Override/merge by id from per-type
  for (const tab of overrideItems) {
    const id = tab.id as string;
    if (!id) continue;
    const existing = merged.get(id);
    if (existing) {
      merged.set(id, deepMerge(existing, tab));
    } else {
      merged.set(id, tab);
    }
  }

  // Order: per-type tabs first (in their order), then remaining base tabs
  const result: Array<Record<string, unknown>> = [];
  const added = new Set<string>();
  for (const tab of overrideItems) {
    const id = tab.id as string;
    if (id && merged.has(id) && !added.has(id)) {
      result.push(merged.get(id)!);
      added.add(id);
    }
  }
  for (const tab of baseItems) {
    const id = tab.id as string;
    if (id && !added.has(id)) {
      result.push(merged.get(id)!);
      added.add(id);
    }
  }

  return result;
}

/**
 * Load a form view configuration.
 *
 * Loads `form-base.yaml` (shared defaults) and the charter-type-specific
 * `form.yaml`, then deep-merges them. Tab arrays are merged by id so that
 * per-type configs only need to define their unique tabs (e.g. formulary).
 *
 * @param charterType  Charter type ID (e.g. "instrumentum-venditionis")
 * @returns FormViewConfig, or null if no charter type provided (form requires a type)
 */
export function loadFormConfig(charterType?: string): FormViewConfig | null {
  if (!charterType) return null;

  const cacheKey = `form:${charterType}`;
  const cached = cache.get(cacheKey) as FormViewConfig | undefined;
  if (cached) return cached;

  // Load the base form config for shared defaults
  const baseRaw = loadYamlFile(viewsPath("form-base.yaml"));
  // Load charter-type-specific form config
  const formPath = viewsPath("charter-types", charterType, "form.yaml");
  const formRaw = loadYamlFile(formPath);

  if (!baseRaw && !formRaw) return null;

  // If only base exists, use it directly
  if (!formRaw && baseRaw) {
    const config: FormViewConfig = {
      charterType: charterType,
      label: (baseRaw.label as string) ?? charterType,
      tabs: baseRaw.tabs as FormViewConfig["tabs"],
    };
    cache.set(cacheKey, config);
    return config;
  }

  // Deep-merge base + per-type, with special tab-array merge
  const baseConfig = { ...baseRaw };
  const overrideConfig = { ...formRaw };

  // Handle tabs.items with id-based merge
  if (baseConfig.tabs && overrideConfig.tabs) {
    const baseTabs = baseConfig.tabs as Record<string, unknown>;
    const overrideTabs = overrideConfig.tabs as Record<string, unknown>;
    const baseItems = (baseTabs.items as Array<Record<string, unknown>>) ?? [];
    const overrideItems =
      (overrideTabs.items as Array<Record<string, unknown>>) ?? [];

    // Merge scalar tab properties (defaultTab) — per-type wins
    const mergedTabs: Record<string, unknown> = {
      ...baseTabs,
      ...overrideTabs,
      items: mergeTabArrays(baseItems, overrideItems),
    };

    const merged = deepMerge(baseConfig as Record<string, unknown>, {
      ...overrideConfig,
      tabs: mergedTabs,
    });

    const config: FormViewConfig = {
      charterType:
        (merged.charterType as string) ?? (formRaw!.charterType as string) ?? charterType,
      label: merged.label as string,
      tabs: merged.tabs as FormViewConfig["tabs"],
    };

    cache.set(cacheKey, config);
    return config;
  }

  // Fallback: no base tabs, or no override tabs — standard deep-merge
  const merged = deepMerge(
    baseConfig as Record<string, unknown>,
    overrideConfig,
  );

  const config: FormViewConfig = {
    charterType:
      (merged.charterType as string) ?? (formRaw!.charterType as string) ?? charterType,
    label: merged.label as string,
    tabs: merged.tabs as FormViewConfig["tabs"],
  };

  cache.set(cacheKey, config);
  return config;
}

// ── Export Views ─────────────────────────────────────────────────────────────

/**
 * Load the export view configuration.
 *
 * @param charterType  Optional charter type for override merge
 */
export function loadExportConfig(charterType?: string): ExportViewConfig {
  const cacheKey = `export:${charterType ?? "__default__"}`;
  const cached = cache.get(cacheKey) as ExportViewConfig | undefined;
  if (cached) return cached;

  const viewRaw = loadYamlFile(viewsPath("export.yaml"));
  if (!viewRaw) {
    throw new Error("[schema/views] Cannot load export.yaml");
  }

  let config: ExportViewConfig = {
    sections: (viewRaw.sections as ExportViewConfig["sections"]) ?? [],
  };

  // Apply charter-type overrides
  if (charterType) {
    const overridePath = viewsPath("charter-types", charterType, "export.yaml");
    const overrideRaw = loadYamlFile(overridePath);
    if (overrideRaw) {
      config = deepMerge(
        config as unknown as Record<string, unknown>,
        overrideRaw,
      ) as unknown as ExportViewConfig;
    }
  }

  cache.set(cacheKey, config);
  return config;
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Get the base view defaults (badge labels, widths, truncation rules, etc.).
 */
export function getBaseDefaults(): BaseViewDefaults {
  return loadBaseDefaults();
}

/**
 * Get badge label for a specific field and value.
 *
 * @param fieldId  Element ID (e.g. "invocatio_analysis")
 * @param value    Enum value (e.g. "symbolica")
 * @returns The human-readable label, or the raw value if no mapping found.
 */
export function getBadgeLabel(fieldId: string, value: string): string {
  const base = loadBaseDefaults();
  return base.badgeLabels[fieldId]?.[value] ?? value;
}

/**
 * Reset the view config cache. Useful during development or testing.
 */
export function clearViewCache(): void {
  cache.clear();
  baseDefaultsCache = null;
}
