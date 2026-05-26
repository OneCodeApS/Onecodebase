import { NextResponse, type NextRequest } from "next/server";
import { verifyJwtSignature } from "@/lib/auth-jwt";
import { minioPublic } from "@/lib/minio";
import { corsPreflight, withCors } from "@/lib/cors";
import { signObjectUrl, verifyObjectToken } from "@/lib/storage-signing";

const METHODS = ["GET", "POST"] as const;
const REDIRECT_EXPIRY_SECONDS = 60;
const DEFAULT_SIGN_TTL = 60 * 60;
const MAX_SIGN_TTL = 60 * 60 * 24 * 7; // 7 days

// GET  /storage/v1/object/sign/<bucket>/<key...>?token=…&expires=…
//   Validates the dashboard-issued HMAC token and 302s to a fresh, short-
//   lived MinIO presigned URL on files.<host>.
//
// POST /storage/v1/object/sign/<bucket>/<key...>
//   Body: { expires_in?: number }
//   Returns: { url, expires_at }
//   Requires a valid JWT (authenticated or service_role). The anon key is
//   intentionally rejected — anyone who has the anon key could otherwise
//   probe object existence by minting signed URLs at will.
async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await ctx.params;
  const key = path.map(decodeURIComponent).join("/");

  if (req.method === "GET") {
    return handleRedirect(req, bucket, key);
  }
  if (req.method === "POST") {
    return handleCreate(req, bucket, key);
  }
  return new NextResponse("Method not allowed", { status: 405 });
}

async function handleRedirect(req: NextRequest, bucket: string, key: string) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expires = Number(req.nextUrl.searchParams.get("expires") ?? "");

  const valid = verifyObjectToken({
    method: "GET",
    bucket,
    key,
    expires,
    token,
  });
  if (!valid) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let presigned: string;
  try {
    presigned = await minioPublic.presignedGetObject(
      bucket,
      key,
      REDIRECT_EXPIRY_SECONDS,
    );
  } catch (e) {
    return NextResponse.json(
      { error: "presign_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
  const res = NextResponse.redirect(presigned, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handleCreate(
  req: NextRequest,
  bucket: string,
  key: string,
) {
  const claims = await readJwt(req);
  if (!claims) {
    return NextResponse.json({ error: "missing_or_invalid_token" }, { status: 401 });
  }
  if (claims.role !== "authenticated" && claims.role !== "service_role") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  let body: { expires_in?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const ttl = clampTtl(body.expires_in ?? DEFAULT_SIGN_TTL);

  const apiBaseUrl = resolveApiBaseUrl(req);
  const signed = signObjectUrl({
    apiBaseUrl,
    bucket,
    key,
    expiresInSeconds: ttl,
  });
  return NextResponse.json(signed);
}

function clampTtl(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SIGN_TTL;
  return Math.min(Math.floor(n), MAX_SIGN_TTL);
}

// Reads a bearer JWT from Authorization or apikey (Supabase convention) and
// returns the verified claims. Returns null on any failure.
async function readJwt(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1] ?? apikey;
  if (!raw) return null;
  try {
    return await verifyJwtSignature(raw);
  } catch {
    return null;
  }
}

// API_PUBLIC_URL is the canonical answer. Falls back to reconstructing from
// the inbound request — Caddy forwards Host/X-Forwarded-Proto on api.*.
function resolveApiBaseUrl(req: NextRequest): string {
  const env = process.env.API_PUBLIC_URL?.replace(/\/+$/, "");
  if (env) return env;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export const GET = withCors(handler, { methods: METHODS });
export const POST = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
