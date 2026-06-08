import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Guard all admin sub-routes (e.g. /admin/form, /admin/dashboard) and
  // admin API routes, but allow the bare /admin path (login page) and
  // the login API endpoint through without auth checks.
  const isAdminRoute =
    (path.startsWith("/admin/") || path === "/admin") &&
    path !== "/admin" &&
    path !== "/api/admin/login";
  const isProtectedApi = path.startsWith("/api/admin/xml");

  if (isAdminRoute || isProtectedApi) {
    const sessionCookie = request.cookies.get("admin-session");

    if (!sessionCookie?.value) {
      const loginUrl = new URL("/admin", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/xml/:path*",
  ],
};
