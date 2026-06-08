import StaticExportPlaceholder from "@/components/StaticExportPlaceholder";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.GITHUB_ACTIONS) {
    return <StaticExportPlaceholder />;
  }

  return <>{children}</>;
}
