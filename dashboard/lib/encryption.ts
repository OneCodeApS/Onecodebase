import crypto from "node:crypto";

// Application-side encryption for secrets stored in Postgres so a DB dump
// (or anyone with dashboard_admin SQL access) sees only ciphertext.
//
// Algorithm: AES-256-GCM (authenticated). Key: 32 random bytes encoded as
// 64 hex chars, sourced from the FUNCTION_ENV_KEY env var. The encrypted
// blob format is `v1:<iv-b64>:<ciphertext-b64>:<authtag-b64>` so we can
// rotate to a different algorithm later by bumping the version prefix.

const ALGO = "aes-256-gcm";
const KEY_HEX_LEN = 64; // 32 bytes
const VERSION = "v1";

function loadKey(): Buffer {
  const hex = process.env.FUNCTION_ENV_KEY;
  if (!hex) {
    throw new Error(
      "FUNCTION_ENV_KEY is not set. Generate one with `openssl rand -hex 32` and add to .env.local (or the prod .env). Once set, do NOT change it without re-encrypting existing values — old ciphertexts become unreadable.",
    );
  }
  if (hex.length !== KEY_HEX_LEN) {
    throw new Error(
      `FUNCTION_ENV_KEY must be exactly ${KEY_HEX_LEN} hex characters (32 bytes).`,
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, loadKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), ct.toString("base64"), tag.toString("base64")].join(":");
}

export function decrypt(packed: string): string {
  const parts = packed.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed ciphertext (or unsupported version)");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, loadKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

// Encryption is configured (env var set + valid length)? Used by callers
// that want to gracefully degrade in dev when the key isn't set yet.
export function isEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}
