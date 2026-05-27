// Runtime version detection for the "Component versions" admin page.
//
// Everything here is best-effort: each detector resolves to a ComponentVersion
// and never throws. When a version can't be read we return version=null with a
// `detail` explaining why, so the page can show *something* honest rather than
// erroring. Detection reflects what is actually RUNNING (queried at request
// time), not the image tags pinned in docker-compose.

import { Client } from "pg";
import { createHash, createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { version as REACT_VERSION } from "react";
import { pool } from "./db";
import dashboardPkg from "@/package.json";

export type ComponentVersion = {
  name: string;
  category: "Application" | "Infrastructure";
  /** Detected version, or null when it couldn't be determined. */
  version: string | null;
  /** Full version string, or a human note on why detection failed/degraded. */
  detail?: string;
  /** How the version was (or would be) obtained. */
  source: string;
};

// Network detectors get a short leash — this page must stay responsive even
// when a service is down or unreachable (e.g. `npm run dev` outside Docker,
// where postgrest/minio hostnames don't resolve).
const TIMEOUT_MS = 2500;

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function unavailable(
  name: string,
  category: ComponentVersion["category"],
  source: string,
  detail: string,
): ComponentVersion {
  return { name, category, version: null, source, detail };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// Release a response body we don't intend to read (we only want the headers),
// without tripping over a null body or a rejected cancel().
function discardBody(res: Response): void {
  void res.body?.cancel?.()?.catch(() => {});
}

// --- Application layer (this Node process) ----------------------------------

function dashboardVersion(): ComponentVersion {
  return {
    name: "Dashboard",
    category: "Application",
    version: dashboardPkg.version,
    source: "package.json",
  };
}

function nodeVersion(): ComponentVersion {
  return {
    name: "Node.js",
    category: "Application",
    version: process.version.replace(/^v/, ""),
    source: "process.version",
  };
}

function reactVersion(): ComponentVersion {
  return {
    name: "React",
    category: "Application",
    version: REACT_VERSION,
    source: "react runtime export",
  };
}

function nextVersion(): ComponentVersion {
  // Prefer the resolved version installed in node_modules; fall back to the
  // declared range in our own package.json if the deep require can't resolve
  // (e.g. not traced into the standalone build).
  try {
    const req = createRequire(import.meta.url);
    const v = (req("next/package.json") as { version: string }).version;
    return { name: "Next.js", category: "Application", version: v, source: "next/package.json" };
  } catch {
    const declared = dashboardPkg.dependencies?.next?.replace(/^[\^~]/, "") ?? null;
    return {
      name: "Next.js",
      category: "Application",
      version: declared,
      source: "package.json (declared)",
      detail: declared ? "declared range — installed version not resolvable" : "not found",
    };
  }
}

// --- Infrastructure ---------------------------------------------------------

async function postgresVersion(): Promise<ComponentVersion> {
  try {
    const { rows } = await pool().query<{ server_version: string; full: string }>(
      "SELECT current_setting('server_version') AS server_version, version() AS full",
    );
    return {
      name: "PostgreSQL",
      category: "Infrastructure",
      version: rows[0]?.server_version ?? null,
      detail: rows[0]?.full,
      source: "SELECT version()",
    };
  } catch (e) {
    return unavailable("PostgreSQL", "Infrastructure", "SELECT version()", msg(e));
  }
}

async function postgrestVersion(): Promise<ComponentVersion> {
  const base = (process.env.POSTGREST_INTERNAL_URL ?? "http://postgrest:3000").replace(/\/+$/, "");
  const source = `${base} (Server header)`;
  try {
    const res = await fetchWithTimeout(`${base}/`);
    // We only need the headers; discard the OpenAPI body.
    discardBody(res);
    const server = res.headers.get("server") ?? "";
    const m = server.match(/postgrest\/?\s*v?([\w.\-]+)/i);
    if (m) {
      return { name: "PostgREST", category: "Infrastructure", version: m[1], source };
    }
    return unavailable(
      "PostgREST",
      "Infrastructure",
      source,
      server ? `unrecognised Server header: ${server}` : "no Server header returned",
    );
  } catch (e) {
    return unavailable("PostgREST", "Infrastructure", source, msg(e));
  }
}

async function pgbouncerVersion(): Promise<ComponentVersion> {
  const url = process.env.DATABASE_URL;
  const source = "admin console (SHOW VERSION)";
  if (!url) return unavailable("PgBouncer", "Infrastructure", source, "DATABASE_URL not set");

  // The dashboard connects as dashboard_admin, which the pgbouncer config
  // lists under admin_users/stats_users — so it may query the special
  // `pgbouncer` admin pseudo-database with the same credentials.
  let adminUrl: string;
  try {
    const u = new URL(url);
    u.pathname = "/pgbouncer";
    adminUrl = u.toString();
  } catch {
    return unavailable("PgBouncer", "Infrastructure", source, "could not parse DATABASE_URL");
  }

  const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: TIMEOUT_MS });
  try {
    await client.connect();
    const res = await client.query("SHOW VERSION");
    // Row looks like { version: "PgBouncer 1.23.1" } — column name varies by
    // version, so just take the first value.
    const raw = res.rows[0] ? String(Object.values(res.rows[0])[0] ?? "") : "";
    const m = raw.match(/(\d+\.\d+(?:\.\d+)?)/);
    return {
      name: "PgBouncer",
      category: "Infrastructure",
      version: m ? m[1] : null,
      detail: raw || (m ? undefined : "no version row returned"),
      source,
    };
  } catch (e) {
    // Outside Docker there's no pgbouncer, so connecting to db "pgbouncer" fails.
    return unavailable("PgBouncer", "Infrastructure", source, msg(e));
  } finally {
    await client.end().catch(() => {});
  }
}

// Minimal AWS SigV4 (S3 service) signer for a GET with an empty body — enough
// to call MinIO's admin API. Uses the same root credentials the storage layer
// already holds.
function signV4Headers(host: string, path: string, accessKey: string, secretKey: string): Record<string, string> {
  const region = process.env.MINIO_REGION ?? "us-east-1";
  const service = "s3";
  const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const datestamp = amzdate.slice(0, 8);
  const payloadHash = createHash("sha256").update("").digest("hex");

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["GET", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${datestamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzdate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(datestamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-date": amzdate,
    "x-amz-content-sha256": payloadHash,
  };
}

async function minioHealthFallback(proto: string, host: string, reason: string): Promise<ComponentVersion> {
  try {
    const res = await fetchWithTimeout(`${proto}://${host}/minio/health/live`);
    discardBody(res);
    if (res.ok) {
      return {
        name: "MinIO",
        category: "Infrastructure",
        version: null,
        detail: `reachable, but version not exposed (${reason})`,
        source: "health probe",
      };
    }
  } catch {
    // fall through
  }
  return unavailable("MinIO", "Infrastructure", "admin API", reason);
}

async function minioVersion(): Promise<ComponentVersion> {
  const endPoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const source = "admin API /minio/admin/v3/info";
  if (!endPoint || !accessKey || !secretKey) {
    return unavailable("MinIO", "Infrastructure", source, "MinIO env vars not set");
  }
  const port = Number(process.env.MINIO_PORT ?? 9000);
  const proto = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  const host = `${endPoint}:${port}`;
  const path = "/minio/admin/v3/info";

  try {
    const headers = signV4Headers(host, path, accessKey, secretKey);
    const res = await fetchWithTimeout(`${proto}://${host}${path}`, { headers });
    if (!res.ok) {
      discardBody(res);
      return await minioHealthFallback(proto, host, `admin info HTTP ${res.status}`);
    }
    const text = await res.text();
    let version: string | null = null;
    try {
      const data = JSON.parse(text) as { servers?: Array<{ version?: string }> };
      version = data.servers?.[0]?.version ?? null;
    } catch {
      // not JSON — fall through to the regex scan
    }
    if (!version) {
      // MinIO versions are RELEASE timestamps; scan the payload as a fallback.
      const m = text.match(/RELEASE\.[0-9TZ:-]+/);
      version = m ? m[0] : null;
    }
    return {
      name: "MinIO",
      category: "Infrastructure",
      version,
      detail: version ? undefined : "admin info returned no recognisable version",
      source,
    };
  } catch (e) {
    return await minioHealthFallback(proto, host, msg(e));
  }
}

function caddyVersion(): ComponentVersion {
  // Caddy doesn't advertise its version in response headers, and its admin
  // API binds to localhost inside the caddy container — unreachable from here.
  // So there's no honest runtime read; flag it rather than guess.
  return unavailable(
    "Caddy",
    "Infrastructure",
    "not runtime-detectable",
    "Caddy hides its version (no Server-header version; admin API is container-local). Check the image tag in docker-compose.yml.",
  );
}

/**
 * Gathers every component's version. Network detectors run concurrently and
 * are individually fault-isolated, so one slow/down service can't break the page.
 */
export async function getComponentVersions(): Promise<ComponentVersion[]> {
  const [pg, postgrest, pgbouncer, minio] = await Promise.all([
    postgresVersion(),
    postgrestVersion(),
    pgbouncerVersion(),
    minioVersion(),
  ]);

  return [
    dashboardVersion(),
    nextVersion(),
    reactVersion(),
    nodeVersion(),
    pg,
    pgbouncer,
    postgrest,
    minio,
    caddyVersion(),
  ];
}
