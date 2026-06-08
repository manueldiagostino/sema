"use client";

import { useState, useEffect, type FormEvent } from "react";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated by probing a protected endpoint.
    // Use redirect: "manual" so the middleware's 307 redirect for
    // unauthenticated requests is NOT followed — otherwise the fetch
    // would follow the redirect to /admin (login page) and get a 200,
    // incorrectly concluding the user is authenticated.
    fetch("/api/admin/xml?filename=__session_check__", { redirect: "manual" })
      .then((res) => {
        // With manual redirect: a valid session passes through the
        // middleware and the API returns a normal response (404 for
        // missing file, or 400 for bad filename). An invalid session
        // gets redirected (type === "opaqueredirect", status 0).
        if (res.type === "basic") {
          setAuthenticated(true);
        }
      })
      .catch(() => {
        // Network error — stay on login
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setAuthenticated(true);
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Checking auth state
  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        </div>
      </main>
    );
  }

  // Authenticated — show dashboard
  if (authenticated) {
    return <AdminDashboard />;
  }

  // Not authenticated — show login form
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6 text-center">
          Sema Admin
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter admin password"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
