import { NextResponse, type NextRequest } from "next/server";
import { revokeSession } from "@/lib/auth-users";

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
  await revokeSession(refreshToken);
  // Always 200 — sign-out is idempotent.
  return NextResponse.json({ ok: true });
}
