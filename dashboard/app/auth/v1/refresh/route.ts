import { NextResponse, type NextRequest } from "next/server";
import { signAccessToken } from "@/lib/auth-jwt";
import { rotateSession } from "@/lib/auth-users";

export async function POST(req: NextRequest) {
  let body: { refresh_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    return NextResponse.json({ error: "missing_refresh_token" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rotated = await rotateSession(refreshToken, { user_agent: ua, ip });
  if (!rotated) {
    return NextResponse.json({ error: "invalid_refresh_token" }, { status: 401 });
  }

  const access = await signAccessToken({
    id: rotated.user.id,
    email: rotated.user.email,
  });

  return NextResponse.json({
    user: { id: rotated.user.id, email: rotated.user.email },
    access_token: access.token,
    token_type: "bearer",
    expires_in: access.expiresIn,
    refresh_token: rotated.refreshToken,
    refresh_expires_at: rotated.expiresAt.toISOString(),
  });
}
