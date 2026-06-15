import { readFileSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";
import type { FormSectionsConfig } from "@/types/form";

let cachedConfig: FormSectionsConfig | null = null;

/**
 * Loads and validates the form section configuration.
 *
 * Primary path: uses the unified schema adapter (`getLegacyFormSections`)
 * which reads from `config/views/charter-types/<type>/form.yaml` and the
 * TEI schema registry.
 *
 * Fallback: if the adapter fails or returns no data, falls back to the
 * legacy `config/form-sections.yaml` file.
 *
 * Results are cached in memory after first load.
 */
export async function loadFormConfig(): Promise<FormSectionsConfig> {
  if (cachedConfig) return cachedConfig;

  // ── Primary: adapter-based loading ──────────────────────────────────
  try {
    // Dynamic import to avoid circular deps and allow graceful fallback
    const adapterMod = await import("@/lib/schema/adapter");
    const registryMod = await import("@/lib/schema/registry");
    const getLegacyFormSections = adapterMod.getLegacyFormSections;
    const getSchemaCharterTypes = registryMod.getCharterTypes;

    const schemaTypes = getSchemaCharterTypes();
    if (schemaTypes.length > 0) {
      const allTypes = schemaTypes.map(
        (ct: { id: string; label: string; object_value?: string; object_subtype_value?: string }) => ({
          id: ct.id,
          label: ct.label,
          object_value: ct.object_value ?? ct.label,
          object_subtype_value: ct.object_subtype_value,
        }),
      );

      // Merge sections from all charter types, preserving applies_to info
      const sectionTypeMap = new Map<string, Set<string>>();
      const sectionDataMap = new Map<string, FormSectionsConfig["sections"][number]>();

      for (const ct of schemaTypes) {
        const config = getLegacyFormSections(ct.id);
        for (const section of config.sections) {
          if (!sectionTypeMap.has(section.id)) {
            sectionTypeMap.set(section.id, new Set());
            sectionDataMap.set(section.id, section);
          }
          sectionTypeMap.get(section.id)!.add(ct.id);
        }
      }

      const sections: FormSectionsConfig["sections"] = [];
      for (const [sectionId, typeSet] of sectionTypeMap) {
        const section = { ...sectionDataMap.get(sectionId)! };
        if (typeSet.size === schemaTypes.length) {
          section.applies_to = "all";
        } else {
          section.applies_to = Array.from(typeSet);
        }
        sections.push(section);
      }

      cachedConfig = { types: allTypes, sections };
      return cachedConfig;
    }
  } catch (err) {
    console.warn("[formConfig] Adapter failed, falling back to YAML:", err);
  }

  // ── Fallback: legacy YAML loading ──────────────────────────────────
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

/**
 * Returns tab definitions for the admin form, derived from the adapter's
 * form view config. Falls back to a static list if the adapter is unavailable.
 */
export async function getFormTabs(): Promise<Array<{ id: string; label: string; type?: string }>> {
  try {
    const viewsMod = await import("@/lib/schema/views");
    const registryMod = await import("@/lib/schema/registry");
    const loadFormViewConfig = viewsMod.loadFormConfig;
    const getSchemaCharterTypes = registryMod.getCharterTypes;

    // Load the form view for the first available charter type to get tab definitions
    const schemaTypes = getSchemaCharterTypes();
    if (schemaTypes.length > 0) {
      const formView = loadFormViewConfig(schemaTypes[0].id.replace(/_/g, "-"));
      if (formView?.tabs?.items) {
        return formView.tabs.items.map(
          (tab: { id: string; label: string; type?: string }) => ({
            id: tab.id,
            label: tab.label,
            type: tab.type,
          }),
        );
      }
    }
  } catch {
    // Adapter unavailable
  }

  // Fallback: static tab list matching form-sections.yaml structure
  return [
    { id: "formulary", label: "Formulary Analysis" },
    { id: "fulltext", label: "Full Text", type: "special" },
    { id: "image", label: "Image", type: "special" },
  ];
}

/** Returns just the charter type options for the type selector dropdown. */
export async function getCharterTypes() {
  const config = await loadFormConfig();
  return config.types;
}

/** Returns sections filtered by the given charter type. */
export async function getSectionsForType(typeId: string) {
  const config = await loadFormConfig();
  return config.sections.filter(
    (s: { applies_to: string | string[] }) =>
      s.applies_to === "all" ||
      (Array.isArray(s.applies_to) && s.applies_to.includes(typeId)),
  );
}

/** Resets the config cache (useful in development). */
export function clearFormConfigCache() {
  cachedConfig = null;
}
