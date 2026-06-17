import { loadFormConfig } from "@/lib/schema/views";
import { loadTeiSchema, getCharterTypes } from "@/lib/schema/registry";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { parseTeiXml } from "@/lib/xmlParser";
import { readFileSync } from "fs";
import { join } from "path";
import { getActiveTeiDir } from "@/lib/dataDir";
import StaticExportPlaceholder from "@/components/StaticExportPlaceholder";

export default async function AdminFormRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  if (process.env.GITHUB_ACTIONS) {
    return <StaticExportPlaceholder />;
  }

  // Load charter types for the type selector
  const charterTypes = getCharterTypes();

  // Load form config and schema for the first charter type
  const defaultTypeKey = charterTypes[0]?.id ?? "instrumentum_venditionis";
  const formConfigKey = defaultTypeKey.replace(/_/g, "-");
  const formConfig = loadFormConfig(formConfigKey);
  const schema = loadTeiSchema(defaultTypeKey);

  if (!formConfig) {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="mx-auto max-w-3xl">
          <p className="text-red-600">No form configuration found.</p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const editFile = params.edit;

  if (editFile) {
    // Basic path-traversal guard
    if (editFile.includes("..") || editFile.includes("/") || editFile.includes("\\")) {
      return (
        <main className="min-h-screen bg-gray-50 py-8 px-4">
          <div className="mx-auto max-w-3xl">
            <p className="text-red-600">Invalid filename.</p>
          </div>
        </main>
      );
    }

    const localTeiDir = getActiveTeiDir(process.cwd());
    const filePath = join(localTeiDir, editFile);
    let xml: string;
    try {
      xml = readFileSync(filePath, "utf-8");
    } catch {
      return (
        <main className="min-h-screen bg-gray-50 py-8 px-4">
          <div className="mx-auto max-w-3xl">
            <p className="text-red-600">File not found: {editFile}</p>
          </div>
        </main>
      );
    }

    // Use engine-native config + schema for XML parsing
    const initialValues = parseTeiXml(xml, formConfig, schema);

    // Derive charter type from filename
    function deriveCode(typeId: string): string {
      const parts = typeId.split("_");
      if (parts.length >= 2) {
        return parts.map((p) => p[0]).join("").toLowerCase();
      }
      return typeId.slice(0, 2).toLowerCase();
    }
    const codeToTypeId = new Map<string, string>();
    for (const t of charterTypes) {
      codeToTypeId.set(deriveCode(t.id), t.id);
    }

    const stem = editFile.replace(/\.xml$/, "");
    let editCharterType = "";

    // Try new format: <code>_<NNNNNN>
    const lastUnderscore = stem.lastIndexOf("_");
    if (lastUnderscore >= 0) {
      const code = stem.slice(0, lastUnderscore);
      const typeId = codeToTypeId.get(code);
      if (typeId && charterTypes.some((t) => t.id === typeId)) {
        editCharterType = typeId;
      }
    }

    // Fallback: try old format <type_id>_<year>_<number>
    if (!editCharterType) {
      editCharterType =
        charterTypes.find((t) => stem.startsWith(t.id + "_"))?.id ?? "";
    }

    return (
      <AdminFormPage
        formConfig={formConfig}
        schema={schema}
        charterTypes={charterTypes}
        initialValues={initialValues as Record<string, unknown>}
        lockedCharterType={editCharterType}
        editFilename={editFile}
      />
    );
  }

  return (
    <AdminFormPage
      formConfig={formConfig}
      schema={schema}
      charterTypes={charterTypes}
    />
  );
}
