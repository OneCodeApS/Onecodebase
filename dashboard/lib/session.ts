// Session helpers, kept separate from lib/auth so middleware (Edge runtime)
// can import sessionOptions and Session without dragging @node-rs/argon2 or
// `pg` into its bundle.
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

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
