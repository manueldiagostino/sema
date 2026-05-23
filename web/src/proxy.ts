import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("admin-session");

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/admin", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all admin-protected routes:
     * - /admin/form/* (the form builder page and any subpages)
     * - /api/admin/* (API routes: login, logout, xml)
     *
     * Do NOT match /admin itself (that's the login page).
     */
    "/admin/form/:path*",
    "/api/admin/xml/:path*",
  ],
};
