import { NextResponse, type NextRequest } from "next/server";
import { verifyJwtSignature } from "@/lib/auth-jwt";
import { minioPublic } from "@/lib/minio";
import { corsPreflight, withCors } from "@/lib/cors";
import { getBucketPolicy, mimeAllowed } from "@/lib/storage";

const METHODS = ["POST"] as const;

// 5 minutes — enough slack to start the upload. Once the PUT request begins,
// MinIO/S3 don't recheck SigV4 expiry, so the actual transfer can take as
// long as it takes (large videos on slow connections are fine).
const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;

// POST /storage/v1/object/upload/<bucket>/<key...>
//
// Body: { size?: number, content_type?: string }
// Response: { upload_url, expires_at, max_upload_mb }
//
// The dashboard validates the bucket policy (max size, MIME allowlist) BEFORE
// issuing the presigned URL. If a caller doesn't provide size / content_type,
// only the existence of the bucket policy + auth is checked — MinIO will
// still accept whatever the client uploads. Pass them when known to fail fast.
async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
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

  const { bucket, path } = await ctx.params;
  const key = path.map(decodeURIComponent).join("/");

  let body: { size?: number; content_type?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const policy = await getBucketPolicy(bucket);

  if (typeof body.size === "number" && body.size > 0) {
    const mb = body.size / (1024 * 1024);
    if (mb > policy.max_upload_mb) {
      return NextResponse.json(
        {
          error: "file_too_large",
          detail: `Bucket allows up to ${policy.max_upload_mb} MB; declared ${mb.toFixed(1)} MB`,
        },
        { status: 413 },
      );
    }
  }
  if (
    typeof body.content_type === "string" &&
    body.content_type.length > 0 &&
    !mimeAllowed(body.content_type, policy.allowed_mime)
  ) {
    return NextResponse.json(
      {
        error: "mime_not_allowed",
        detail: `Content type "${body.content_type}" is not allowed for this bucket`,
      },
      { status: 415 },
    );
  }

  let uploadUrl: string;
  try {
    uploadUrl = await minioPublic.presignedPutObject(
      bucket,
      key,
      UPLOAD_URL_EXPIRY_SECONDS,
    );
  } catch (e) {
    return NextResponse.json(
      { error: "presign_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
  const expiresAt = new Date(
    Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000,
  ).toISOString();

  return NextResponse.json({
    upload_url: uploadUrl,
    expires_at: expiresAt,
    max_upload_mb: policy.max_upload_mb,
  });
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

export const POST = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
