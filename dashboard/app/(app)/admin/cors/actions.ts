"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSetting, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import {
  ORIGINS_SETTING_KEY,
  envAllowedOrigins,
  bustOriginsCache,
} from "@/lib/cors";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function requireAdmin() {
  const s = await getSession();
  if (s.role !== "admin") redirect("/");
  return s;
}

// The list to mutate: the DB setting if it's ever been written, otherwise seed
// from the env var so existing env-configured origins survive the first edit.
async function currentOrigins(): Promise<string[]> {
  const stored = await getSetting<string[]>(ORIGINS_SETTING_KEY);
  return Array.isArray(stored) ? stored : envAllowedOrigins();
}

// Canonicalize user input to an exact origin (`scheme://host[:port]`, no path
// or trailing slash). `*` (any origin) is allowed through verbatim. Returns
// null for anything that isn't a valid http(s) origin.
function normalizeOrigin(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s === "*") return "*";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // URL.origin drops any path/query/hash and the trailing slash, giving the
  // canonical form we compare the request's Origin header against.
  return u.origin === "null" ? null : u.origin;
}

export async function addOrigin(formData: FormData) {
  const session = await requireAdmin();
  const raw = String(formData.get("origin") ?? "");
  const origin = normalizeOrigin(raw);
  if (!origin) {
    redirect(
      "/admin/cors?error=" +
        encodeURIComponent(
          `Not a valid origin: "${raw.trim()}". Use scheme://host[:port] with no path (e.g. https://app.example.com), or * for any origin.`,
        ),
    );
  }

  const list = await currentOrigins();
  if (list.includes(origin)) {
    redirect("/admin/cors?error=" + encodeURIComponent(`Already allowed: ${origin}`));
  }

  const next = [...list, origin];
  await setSetting(ORIGINS_SETTING_KEY, next, session.userId ?? null);
  bustOriginsCache();

  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "settings.cors_origins.add",
    target: ORIGINS_SETTING_KEY,
    ip: await clientIp(),
    sessionId: session.sessionId ?? null,
    metadata: { added: origin, count: next.length },
  });

  redirect("/admin/cors?ok=" + encodeURIComponent(`Added ${origin}`));
}

export async function removeOrigin(formData: FormData) {
  const session = await requireAdmin();
  const origin = String(formData.get("origin") ?? "");

  const list = await currentOrigins();
  if (!list.includes(origin)) {
    // Already gone (double-submit / stale page) — nothing to do.
    redirect("/admin/cors");
  }

  const next = list.filter((o) => o !== origin);
  await setSetting(ORIGINS_SETTING_KEY, next, session.userId ?? null);
  bustOriginsCache();

  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "settings.cors_origins.remove",
    target: ORIGINS_SETTING_KEY,
    ip: await clientIp(),
    sessionId: session.sessionId ?? null,
    metadata: { removed: origin, count: next.length },
  });

  redirect("/admin/cors?ok=" + encodeURIComponent(`Removed ${origin}`));
}
