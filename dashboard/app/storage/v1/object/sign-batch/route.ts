import { NextResponse, type NextRequest } from "next/server";
import { verifyJwtSignature } from "@/lib/auth-jwt";
import { corsPreflight, withCors } from "@/lib/cors";
import { signObjectUrl } from "@/lib/storage-signing";

const METHODS = ["POST"] as const;
const DEFAULT_SIGN_TTL = 60 * 60;
const MAX_SIGN_TTL = 60 * 60 * 24 * 7;
const MAX_BATCH = 100;

type Item = { bucket: string; key: string };
type Body = { items: Item[]; expires_in?: number };

// POST /storage/v1/object/sign-batch
//
// Mints up to MAX_BATCH signed download URLs in one round-trip. Galleries
// rendering N thumbnails should call this once rather than N times — the
// per-request cost is JWT verification + HMAC computation per item; both
// are O(microseconds), so a batch of 100 is cheap to serve.
async function handler(req: NextRequest) {
  const claims = await readJwt(req);
  if (!claims) {
    return NextResponse.json(
      { error: "missing_or_invalid_token" },
      { status: 401 },
    );
  }
  if (claims.role !== "authenticated" && claims.role !== "service_role") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }
  if (body.items.length > MAX_BATCH) {
    return NextResponse.json(
      { error: "too_many_items", detail: `max ${MAX_BATCH} per call` },
      { status: 400 },
    );
  }

  const ttl = clampTtl(body.expires_in ?? DEFAULT_SIGN_TTL);
  const apiBaseUrl = resolveApiBaseUrl(req);

  const items = body.items.map((it) => {
    const signed = signObjectUrl({
      apiBaseUrl,
      bucket: it.bucket,
      key: it.key,
      expiresInSeconds: ttl,
    });
    return { bucket: it.bucket, key: it.key, ...signed };
  });

  return NextResponse.json({ items });
}

function clampTtl(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SIGN_TTL;
  return Math.min(Math.floor(n), MAX_SIGN_TTL);
}

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

function resolveApiBaseUrl(req: NextRequest): string {
  const env = process.env.API_PUBLIC_URL?.replace(/\/+$/, "");
  if (env) return env;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export const POST = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
