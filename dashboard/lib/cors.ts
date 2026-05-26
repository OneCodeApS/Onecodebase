import { NextResponse, type NextRequest } from "next/server";

// Origin allowlist for browser-facing public APIs. Configured via the
// AUTH_ALLOWED_ORIGINS env var as a comma-separated list:
//   ""                       → no cross-origin browser access
//   "*"                      → reflect any origin (bearer-only; cookies unsafe)
//   "https://app.example.com,https://staging.example.com" → exact match
//
// Non-browser clients (curl, server-to-server) don't enforce CORS, so they
// keep working regardless of this setting — only browser apps from origins
// outside the list will be blocked from reading responses.
function allowedOrigins(): string[] {
  return (process.env.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveAllowOrigin(reqOrigin: string | null): string | null {
  const list = allowedOrigins();
  if (list.length === 0) return null;
  if (list.includes("*")) return reqOrigin ?? "*";
  if (reqOrigin && list.includes(reqOrigin)) return reqOrigin;
  return null;
}

// Headers added to every CORS-eligible response. We deliberately don't set
// `Access-Control-Allow-Credentials: true` — refresh tokens travel in the
// JSON body, not cookies, so credentials would only widen attack surface
// (and conflict with the wildcard origin case).
function corsHeaders(allowOrigin: string, methods: readonly string[]): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allowOrigin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", methods.join(", "));
  h.set(
    "Access-Control-Allow-Headers",
    "content-type, authorization, apikey, x-client-info",
  );
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

type Handler = (req: NextRequest) => Promise<Response> | Response;

type CorsOptions = {
  // HTTP verbs this route exposes. OPTIONS is added automatically.
  methods: readonly string[];
};

// Wraps a route handler so it:
//   1. Adds Access-Control-* headers to the real response when the request
//      origin is in the allowlist.
//   2. Lets non-browser callers (no Origin header) through untouched.
// Pair with corsPreflight() to handle the OPTIONS preflight on the same route.
export function withCors(handler: Handler, opts: CorsOptions): Handler {
  return async (req) => {
    const allow = resolveAllowOrigin(req.headers.get("origin"));
    const res = await handler(req);
    if (allow) {
      const cors = corsHeaders(allow, [...opts.methods, "OPTIONS"]);
      cors.forEach((v, k) => res.headers.set(k, v));
    }
    return res;
  };
}

// Standalone OPTIONS handler. Returns 204 with the CORS headers for allowed
// origins; 403 for everything else. Export as `OPTIONS` from a route file:
//   export const OPTIONS = corsPreflight({ methods: ["POST"] });
export function corsPreflight(opts: CorsOptions): Handler {
  return async (req) => {
    const allow = resolveAllowOrigin(req.headers.get("origin"));
    if (!allow) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(allow, [...opts.methods, "OPTIONS"]),
    });
  };
}
