import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// PostgREST validates JWTs against this same secret, so the API authorises
// requests as the correct role just by virtue of the access token we issue.
// PGRST_JWT_SECRET must be the same value the postgrest service was started with.
function jwtSecret(): Uint8Array {
  const s = process.env.PGRST_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("PGRST_JWT_SECRET must be set and at least 32 chars");
  }
  return new TextEncoder().encode(s);
}

export type AccessClaims = JWTPayload & {
  sub: string;
  email: string;
  role: "authenticated";
};

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour

export async function signAccessToken(user: {
  id: string;
  email: string;
}): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: "authenticated",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(jwtSecret());
  return { token, expiresIn: ACCESS_TOKEN_TTL };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, jwtSecret(), {
    algorithms: ["HS256"],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Malformed access token");
  }
  return payload as AccessClaims;
}

// Looser sibling of verifyAccessToken. Validates only the signature and the
// algorithm — no claim shape requirements. Lets a single JWT_SECRET cover
// the same three roles Supabase uses:
//   - "anon"           — long-lived, embedded in client code (no sub/email)
//   - "authenticated"  — per-user tokens issued by /auth/v1/* (has sub/email)
//   - "service_role"   — server-side admin tokens (typically no sub/email)
// Edge functions read ctx.user.role to decide what the caller can do.
export type AnyJwtClaims = JWTPayload & {
  sub?: string;
  email?: string;
  role?: string;
};

export async function verifyJwtSignature(token: string): Promise<AnyJwtClaims> {
  const { payload } = await jwtVerify(token, jwtSecret(), {
    algorithms: ["HS256"],
  });
  return payload as AnyJwtClaims;
}

// Anon / service_role keys are deterministic — same JWT every call, given a
// stable PGRST_JWT_SECRET. No iat (which would change them per generation);
// a fixed far-future exp keeps libraries that require an exp claim happy.
// Rotating the secret invalidates these keys (and every user JWT), so don't
// rotate it casually.
const KEYS_EXP_SECONDS = Math.floor(
  new Date("2100-01-01T00:00:00Z").getTime() / 1000,
);

async function signFixedRoleKey(role: "anon" | "service_role"): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(KEYS_EXP_SECONDS)
    .sign(jwtSecret());
}

export function getAnonKey(): Promise<string> {
  return signFixedRoleKey("anon");
}

export function getServiceRoleKey(): Promise<string> {
  return signFixedRoleKey("service_role");
}
