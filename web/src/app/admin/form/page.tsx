import { loadFormConfig } from "@/lib/formConfig";
import AdminFormPage from "@/components/admin/AdminFormPage";

export default function AdminFormRoutePage() {
  const config = loadFormConfig();

  return <AdminFormPage config={config} />;
}
