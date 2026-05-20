"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSetting, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function updateAuditSubdir(formData: FormData) {
  const session = await getSession();
  if (session.role !== "admin") redirect("/");

  const raw = String(formData.get("subdir") ?? "").trim();
  const sanitized = raw.replace(/[^a-zA-Z0-9._-]/g, "_") || "default";

  const previous = (await getSetting<string>("audit_subdir")) ?? "default";
  await setSetting("audit_subdir", sanitized, session.userId ?? null);

  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "settings.audit_subdir.update",
    target: "audit_subdir",
    ip: await clientIp(),
    sessionId: session.sessionId ?? null,
    metadata: { from: previous, to: sanitized, raw_input: raw },
  });

  const msg = sanitized === raw ? `Saved: ${sanitized}` : `Saved (sanitized): ${sanitized}`;
  redirect("/admin/settings?ok=" + encodeURIComponent(msg));
}
