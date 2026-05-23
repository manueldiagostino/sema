import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me-in-production";

export async function POST() {
  const session = await getIronSession<{ isAdmin?: boolean }>(
    await cookies(),
    {
      cookieName: "admin-session",
      password: COOKIE_SECRET,
    },
  );

  session.destroy();

  return NextResponse.redirect(
    new URL(
      "/admin",
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
  );
}
