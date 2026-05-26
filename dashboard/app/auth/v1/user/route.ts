import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth-jwt";
import { pool } from "@/lib/db";
import { corsPreflight, withCors } from "@/lib/cors";

const METHODS = ["GET"] as const;

async function handler(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json({ error: "missing_bearer" }, { status: 401 });
  }
  let claims;
  try {
    claims = await verifyAccessToken(m[1]);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_token", detail: (e as Error).message },
      { status: 401 },
    );
  }

  const { rows } = await pool().query<{
    id: string;
    email: string;
    email_verified_at: Date | null;
    created_at: Date;
    last_sign_in_at: Date | null;
    disabled_at: Date | null;
    raw_user_metadata: Record<string, unknown>;
  }>(
    `SELECT id, email, email_verified_at, created_at,
            last_sign_in_at, disabled_at, raw_user_metadata
       FROM auth.users WHERE id = $1`,
    [claims.sub],
  );
  const user = rows[0];
  if (!user || user.disabled_at) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    email_verified_at: user.email_verified_at,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    metadata: user.raw_user_metadata,
  });
}

export const GET = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
