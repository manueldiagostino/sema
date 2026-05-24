import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Only intercept admin-protected routes.
  // Skip /admin itself (login page) and /api/admin/login (login endpoint).
  if (
    path.startsWith("/admin/form") ||
    path.startsWith("/api/admin/xml")
  ) {
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
    "/admin/form/:path*",
    "/api/admin/xml/:path*",
  ],
};
