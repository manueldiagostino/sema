import { readFileSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";
import type { FormSectionsConfig } from "@/types/form";

let cachedConfig: FormSectionsConfig | null = null;

/**
 * Loads and validates the form section configuration from form-sections.yaml.
 * Results are cached in memory after first load.
 */
export function loadFormConfig(): FormSectionsConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = join(process.cwd(), "config", "form-sections.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const config = load(raw) as FormSectionsConfig;

  if (!config.types || config.types.length === 0) {
    throw new Error("form-sections.yaml must define at least one charter type");
  }

  if (!config.sections || config.sections.length === 0) {
    throw new Error("form-sections.yaml must define at least one section");
  }

  cachedConfig = config;
  return config;
}

/** Returns just the charter type options for the type selector dropdown. */
export function getCharterTypes() {
  return loadFormConfig().types;
}

/** Returns sections filtered by the given charter type. */
export function getSectionsForType(typeId: string) {
  const config = loadFormConfig();
  return config.sections.filter(
    (s) =>
      s.applies_to === "all" ||
      (Array.isArray(s.applies_to) && s.applies_to.includes(typeId)),
  );
}

/** Resets the config cache (useful in development). */
export function clearFormConfigCache() {
  cachedConfig = null;
}
