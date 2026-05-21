"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function logout() {
  const session = await getSession();
  const actor = session.email;
  const actorId = session.userId ?? null;
  const role = session.role ?? null;
  const sessionId = session.sessionId ?? null;
  session.destroy();
  if (actor) {
    await audit({
      actor,
      actorId,
      role,
      action: "logout",
      ip: await clientIp(),
      sessionId,
    });
  }
  redirect("/login");
}
