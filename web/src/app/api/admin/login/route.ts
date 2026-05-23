import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me-in-production";

export async function POST(request: Request) {
  let password: string;
  try {
    const body = await request.json();
    password = body.password;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 },
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getIronSession<{ isAdmin: boolean }>(
    await cookies(),
    {
      cookieName: "admin-session",
      password: COOKIE_SECRET,
      ttl: 60 * 60 * 8, // 8 hours
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  );

  session.isAdmin = true;
  await session.save();

  return NextResponse.json({ success: true });
}
