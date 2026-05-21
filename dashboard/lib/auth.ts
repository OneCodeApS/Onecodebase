import { hash, verify } from "@node-rs/argon2";
import { pool } from "./db";
import type { UserRole } from "./session";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return verify(stored, plain);
}

export type User = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  disabled_at: Date | null;
};

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool().query<User>(
    `SELECT id, email, password_hash, role, disabled_at
       FROM _dashboard.users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}
