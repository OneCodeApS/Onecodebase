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
