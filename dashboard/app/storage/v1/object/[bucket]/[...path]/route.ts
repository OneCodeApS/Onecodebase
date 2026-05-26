import { NextResponse, type NextRequest } from "next/server";
import { verifyJwtSignature } from "@/lib/auth-jwt";
import { minio } from "@/lib/minio";
import { corsPreflight, withCors } from "@/lib/cors";

const METHODS = ["HEAD", "DELETE"] as const;

// HEAD   /storage/v1/object/<bucket>/<key...>
//   Requires a JWT (any role beyond anon). Returns size + content-type +
//   etag in headers. Used by clients to probe an object's existence and
//   size before download — e.g. video players that want Content-Length
//   without starting a stream.
//
// DELETE /storage/v1/object/<bucket>/<key...>
//   Requires service_role. End-user JWTs cannot delete arbitrary objects
//   through the public API — until per-object ownership / RLS lands,
//   "service_role only" keeps the safe default.
async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await ctx.params;
  const key = path.map(decodeURIComponent).join("/");

  if (req.method === "HEAD") return handleHead(req, bucket, key);
  if (req.method === "DELETE") return handleDelete(req, bucket, key);
  return new NextResponse("Method not allowed", { status: 405 });
}

async function handleHead(req: NextRequest, bucket: string, key: string) {
  const claims = await readJwt(req);
  if (!claims) return new NextResponse(null, { status: 401 });
  if (claims.role === "anon" || !claims.role) {
    return new NextResponse(null, { status: 403 });
  }

  let stat;
  try {
    stat = await minio.statObject(bucket, key);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const headers = new Headers();
  headers.set("Content-Length", String(stat.size));
  const ct = stat.metaData?.["content-type"];
  if (ct) headers.set("Content-Type", ct);
  if (stat.etag) headers.set("ETag", `"${stat.etag}"`);
  if (stat.lastModified) {
    headers.set("Last-Modified", new Date(stat.lastModified).toUTCString());
  }
  return new NextResponse(null, { status: 200, headers });
}

async function handleDelete(req: NextRequest, bucket: string, key: string) {
  const claims = await readJwt(req);
  if (!claims) {
    return NextResponse.json(
      { error: "missing_or_invalid_token" },
      { status: 401 },
    );
  }
  if (claims.role !== "service_role") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }
  try {
    await minio.removeObject(bucket, key);
  } catch (e) {
    return NextResponse.json(
      { error: "delete_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
  return new NextResponse(null, { status: 204 });
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

export const HEAD = withCors(handler, { methods: METHODS });
export const DELETE = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
