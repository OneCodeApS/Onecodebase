import { NextResponse, type NextRequest } from "next/server";
import { signAccessToken } from "@/lib/auth-jwt";
import {
  createSession,
  createUser,
  findUserByEmail,
  hashPassword,
  upsertIdentity,
} from "@/lib/auth-users";
import { getAuthSettings, isProviderEnabled } from "@/lib/auth-settings";

export async function POST(req: NextRequest) {
  const [settings, emailEnabled] = await Promise.all([
    getAuthSettings(),
    isProviderEnabled("email"),
  ]);
  if (!settings.allow_signups) {
    return NextResponse.json({ error: "signups_disabled" }, { status: 403 });
  }
  if (!emailEnabled) {
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

  if (!email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 12) {
    return NextResponse.json(
      { error: "password_too_short", detail: "Password must be at least 12 characters" },
      { status: 400 },
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const encrypted = await hashPassword(password);
  const user = await createUser({ email, encrypted_password: encrypted });

  await upsertIdentity({
    user_id: user.id,
    provider: "email",
    provider_user_id: user.email,
    identity_data: { email: user.email },
  });

  const ua = req.headers.get("user-agent");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const session = await createSession({ user_id: user.id, user_agent: ua, ip });
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
