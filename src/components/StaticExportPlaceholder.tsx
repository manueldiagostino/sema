import Link from "next/link";

export default function StaticExportPlaceholder() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Admin Unavailable</h1>
        <p className="text-gray-600 mb-6">
          The admin panel requires server-side API routes and is not available in
          this static deployment. To access the admin features, run the application
          locally with <code className="bg-gray-200 rounded px-1.5 py-0.5 text-sm">npm run dev</code>.
        </p>
        <Link
          href="/"
          transitionTypes={["page"]}
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Back to corpus explorer
        </Link>
      </div>
    </main>
  );
}
