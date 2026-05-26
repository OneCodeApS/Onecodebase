import { Client } from "minio";

declare global {
  // eslint-disable-next-line no-var
  var __minioClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __minioPublicClient: Client | undefined;
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

function resolveInternal(): Client {
  if (!globalThis.__minioClient) {
    globalThis.__minioClient = buildClient();
  }
  return globalThis.__minioClient;
}

// Internal client — used by the dashboard process to perform bucket / object
// operations. In Docker this connects to `minio:9000` over the bridge network.
//
// Wrapped in a Proxy so the underlying Client is constructed on first method
// access, not at module load. Required because `next build` evaluates this
// module while collecting page data — env vars aren't available at that point
// and the old eager construction crashed the build.
export const minio: Client = new Proxy({} as Client, {
  get(_t, prop, receiver) {
    const target = resolveInternal();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

// Public-facing client — same credentials but configured with the hostname
// the user's browser will actually use (presigned GET URLs, etc.). Configured
// from MINIO_PUBLIC_URL; falls back to the internal client if not set.
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

function resolvePublic(): Client {
  if (!globalThis.__minioPublicClient) {
    globalThis.__minioPublicClient = buildPublicClient() ?? resolveInternal();
  }
  return globalThis.__minioPublicClient;
}

export const minioPublic: Client = new Proxy({} as Client, {
  get(_t, prop, receiver) {
    const target = resolvePublic();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
