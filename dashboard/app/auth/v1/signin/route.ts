import { NextResponse, type NextRequest } from "next/server";
import { signAccessToken } from "@/lib/auth-jwt";
import {
  createSession,
  findUserByEmail,
  touchLastSignIn,
  verifyPassword,
} from "@/lib/auth-users";
import { isProviderEnabled } from "@/lib/auth-settings";

export async function POST(req: NextRequest) {
  if (!(await isProviderEnabled("email"))) {
    return NextResponse.json({ error: "email_provider_disabled" }, { status: 403 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const user = await findUserByEmail(email);
  // Constant-ish response so we don't leak which path failed.
  const ok =
    !!user &&
    !user.disabled_at &&
    !!user.encrypted_password &&
    (await verifyPassword(user.encrypted_password, password));

  if (!ok || !user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ua = req.headers.get("user-agent");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const session = await createSession({ user_id: user.id, user_agent: ua, ip });
  await touchLastSignIn(user.id);
  const access = await signAccessToken({ id: user.id, email: user.email });

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    access_token: access.token,
    token_type: "bearer",
    expires_in: access.expiresIn,
    refresh_token: session.refreshToken,
    refresh_expires_at: session.expiresAt.toISOString(),
  });
}
