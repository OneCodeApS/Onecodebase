import { Client } from "minio";

declare global {
  // eslint-disable-next-line no-var
  var __minioClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __minioPublicClient: Client | null | undefined;
}

function buildClient(): Client {
  const endPoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!endPoint || !accessKey || !secretKey) {
    throw new Error("MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY must be set");
  }
  return new Client({
    endPoint,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey,
    secretKey,
  });
}

// Internal client — used by the dashboard process to perform bucket / object
// operations. In Docker this connects to `minio:9000` over the bridge network.
export const minio: Client = globalThis.__minioClient ?? buildClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__minioClient = minio;
}

// Public-facing client — same credentials but configured with the hostname
// the user's browser will actually use. Returned URLs (presigned GET, etc.)
// need a host the browser can resolve, which is NOT `minio:9000` in Docker.
//
// Configured from MINIO_PUBLIC_URL (e.g. "https://files.example.com" in prod,
// "http://127.0.0.1:9000" in `npm run dev`). Falls back to the internal client
// if MINIO_PUBLIC_URL isn't set, but generated URLs probably won't work from
// the browser in that case.
function buildPublicClient(): Client | null {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!publicUrl || !accessKey || !secretKey) return null;
  try {
    const u = new URL(publicUrl);
    return new Client({
      endPoint: u.hostname,
      port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
      useSSL: u.protocol === "https:",
      accessKey,
      secretKey,
    });
  } catch {
    return null;
  }
}

export const minioPublic: Client =
  globalThis.__minioPublicClient ?? buildPublicClient() ?? minio;
if (process.env.NODE_ENV !== "production") {
  globalThis.__minioPublicClient = minioPublic;
}

// Returns the public, browser-friendly base URL (e.g. "https://files.example.com")
// or null if MINIO_PUBLIC_URL isn't configured.
export function minioPublicBaseUrl(): string | null {
  const v = process.env.MINIO_PUBLIC_URL;
  if (!v) return null;
  return v.replace(/\/+$/, "");
}
