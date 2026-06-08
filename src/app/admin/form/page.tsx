import { loadFormConfig } from "@/lib/formConfig";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { parseTeiXml } from "@/lib/xmlParser";
import { readFileSync } from "fs";
import { join } from "path";
import { getActiveTeiDir } from "@/lib/dataDir";

export default async function AdminFormRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
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
    // Filename format: <type_id>_<year>_<number>.xml
    // e.g. "instrumentum_venditionis_1136_01.xml" → type_id = "instrumentum_venditionis"
    // Match known types from config against the filename stem
    const stem = editFile.replace(/\.xml$/, "");
    const charterType =
      config.types.find((t) => stem.startsWith(t.id + "_"))?.id || "";

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
