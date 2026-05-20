import { hash, verify } from "@node-rs/argon2";
import { pool } from "./db";

// Argon2id with sensible defaults. @node-rs/argon2's defaults are already
// reasonable for an interactive login on modest hardware.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return verify(stored, plain);
}

export type Admin = {
  id: string;
  email: string;
  password_hash: string;
};

export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const { rows } = await pool().query<Admin>(
    "SELECT id, email, password_hash FROM _dashboard.admins WHERE email = $1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}
