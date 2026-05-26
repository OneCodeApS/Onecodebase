import { NextResponse, type NextRequest } from "next/server";
import { minioPublic } from "@/lib/minio";
import { getBucketPolicy } from "@/lib/storage";
import { corsPreflight, withCors } from "@/lib/cors";

const METHODS = ["GET"] as const;

// Short-lived because the dashboard, not MinIO, is the canonical authorization
// gate. A long-lived presigned URL would let anyone re-share it. 60s is enough
// for the browser to follow the redirect and (for media tags) issue Range
// requests against the same URL.
const REDIRECT_EXPIRY_SECONDS = 60;

// GET /storage/v1/object/public/<bucket>/<key...>
//
// Looks up the bucket policy; if the bucket is marked public, generates a
// fresh 60-second MinIO presigned URL on files.<host> and 302s the client.
// Otherwise returns 404 — we don't distinguish between "no such bucket" and
// "exists but private," to avoid leaking object existence.
async function handler(
  _req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await ctx.params;
  const key = path.map(decodeURIComponent).join("/");

  const policy = await getBucketPolicy(bucket);
  if (policy.visibility !== "public") {
    return new NextResponse("Not found", { status: 404 });
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

  // Cache-Control on the 302 itself so browsers / intermediaries don't
  // memoize a presigned URL that will quickly expire.
  const res = NextResponse.redirect(presigned, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const GET = withCors(handler, { methods: METHODS });
export const OPTIONS = corsPreflight({ methods: METHODS });
