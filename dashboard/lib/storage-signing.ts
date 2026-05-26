import crypto from "node:crypto";

// HMAC-based signing for dashboard-issued storage URLs.
//
// Why HMAC and not SigV4: every dashboard-issued URL has the form
//   https://api.<host>/storage/v1/object/sign/<bucket>/<key>?token=…&expires=…
// The signature must be computable + verifiable purely from those query
// params. SigV4 would require the client to send canonical headers; HMAC
// over a small fixed string is the simplest scheme that still gives a
// non-forgeable token. The actual MinIO presigned URL handed to the client
// in the 302 response uses SigV4 — that's a separate, very short-lived URL.
//
// Token body:
//   HMAC-SHA256(STORAGE_SIGNING_KEY,
//               `${method}\n${bucket}\n${key}\n${expires}`)
// `method` is included so a token issued for download can't be replayed as
// an upload. `expires` is unix seconds.

const KEY_ENV = "STORAGE_SIGNING_KEY";

function signingKey(): Buffer {
  const v = process.env[KEY_ENV];
  if (!v) {
    throw new Error(
      `${KEY_ENV} must be set (32+ hex chars) for storage URL signing`,
    );
  }
  return Buffer.from(v, "hex");
}

function compute(
  method: "GET" | "PUT" | "DELETE",
  bucket: string,
  key: string,
  expires: number,
): string {
  const h = crypto.createHmac("sha256", signingKey());
  h.update(`${method}\n${bucket}\n${key}\n${expires}`);
  return h.digest("hex");
}

export type SignedUrl = {
  url: string;
  expires_at: string;
};

// Builds a dashboard-signed download URL pointing at api.<host>/storage/v1.
// The recipient hits that URL, the dashboard validates the HMAC, then 302s
// to a freshly-minted MinIO presigned URL on files.<host>.
//
// `apiBaseUrl` should be the public URL of api.* (e.g.
// `https://api.example.com`). It's passed in rather than read from env so
// the caller controls trust boundaries — the request handler knows its
// own host; library code shouldn't be guessing.
export function signObjectUrl({
  apiBaseUrl,
  bucket,
  key,
  expiresInSeconds,
}: {
  apiBaseUrl: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
}): SignedUrl {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = compute("GET", bucket, key, expires);
  const base = apiBaseUrl.replace(/\/+$/, "");
  const path = `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(key)}`;
  const qs = new URLSearchParams({ token, expires: String(expires) });
  return {
    url: `${base}${path}?${qs.toString()}`,
    expires_at: new Date(expires * 1000).toISOString(),
  };
}

// URL-encodes each path segment but keeps `/` as separators so nested keys
// survive intact ("photos/2026/05/a.png").
function encodePath(key: string): string {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

// Returns true when the (token, expires) tuple was issued by this server
// for exactly (method, bucket, key) and hasn't expired yet. Uses
// timing-safe comparison.
export function verifyObjectToken({
  method,
  bucket,
  key,
  expires,
  token,
}: {
  method: "GET" | "PUT" | "DELETE";
  bucket: string;
  key: string;
  expires: number;
  token: string;
}): boolean {
  if (!Number.isFinite(expires)) return false;
  if (Math.floor(Date.now() / 1000) >= expires) return false;

  const expected = compute(method, bucket, key, expires);
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
