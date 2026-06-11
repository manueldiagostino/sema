import { loadFormConfig } from "@/lib/formConfig";
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

  const config = loadFormConfig();
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

    const initialValues = parseTeiXml(xml, config);

    // Extract charter type from filename
    // New format: <code>_<NNNNNN>.xml (e.g. "iv_000001.xml")
    // Old format: <type_id>_<year>_<number>.xml
    // Build a code→typeId lookup from config types
    function deriveCode(typeId: string): string {
      const parts = typeId.split("_");
      if (parts.length >= 2) {
        return parts.map((p) => p[0]).join("").toLowerCase();
      }
      return typeId.slice(0, 2).toLowerCase();
    }
    const codeToTypeId = new Map<string, string>();
    for (const t of config.types) {
      codeToTypeId.set(deriveCode(t.id), t.id);
    }

    const stem = editFile.replace(/\.xml$/, "");
    let charterType = "";

    // Try new format: <code>_<NNNNNN>
    const lastUnderscore = stem.lastIndexOf("_");
    if (lastUnderscore >= 0) {
      const code = stem.slice(0, lastUnderscore);
      const typeId = codeToTypeId.get(code);
      if (typeId && config.types.some((t) => t.id === typeId)) {
        charterType = typeId;
      }
    }

    // Fallback: try old format <type_id>_<year>_<number>
    if (!charterType) {
      charterType =
        config.types.find((t) => stem.startsWith(t.id + "_"))?.id || "";
    }

    return (
      <AdminFormPage
        config={config}
        initialValues={initialValues as Record<string, unknown>}
        lockedCharterType={charterType}
        editFilename={editFile}
      />
    );
  }

  return <AdminFormPage config={config} />;
}
