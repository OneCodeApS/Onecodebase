import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { hash, verify } from "@node-rs/argon2";
import { pool } from "./db";

export type Session = {
  adminId?: string;
  email?: string;
  // CSRF token bound to this session; double-submitted from forms.
  csrf?: string;
};

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  // Fail fast at module load so we never run with a weak secret.
  throw new Error("SESSION_SECRET must be set and at least 32 characters");
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: "dash_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

export async function getSession(): Promise<Session> {
  return getIronSession<Session>(await cookies(), sessionOptions);
}

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
  const { rows } = await pool.query<Admin>(
    "SELECT id, email, password_hash FROM _dashboard.admins WHERE email = $1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}
