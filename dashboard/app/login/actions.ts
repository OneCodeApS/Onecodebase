"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import { findUserByEmail, verifyPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

function safeNext(next: FormDataEntryValue | null): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required")}`);
  }

  const user = await findUserByEmail(email);
  const passwordOk = user ? await verifyPassword(user.password_hash, password) : false;
  const disabled = user?.disabled_at != null;
  const ok = !!user && passwordOk && !disabled;

  const ip = await clientIp();

  if (!ok) {
    let reason: string;
    if (!user) reason = "unknown_email";
    else if (!passwordOk) reason = "bad_password";
    else reason = "account_disabled";
    await audit({
      actor: email || "<unknown>",
      actorId: user?.id ?? null,
      role: user?.role ?? null,
      action: "login",
      success: false,
      ip,
      metadata: { reason },
    });
    redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
  }

  const session = await getSession();
  session.userId = user!.id;
  session.email = user!.email;
  session.role = user!.role;
  session.sessionId = randomUUID();
  session.csrf = randomBytes(32).toString("hex");
  await session.save();

  await audit({
    actor: user!.email,
    actorId: user!.id,
    role: user!.role,
    action: "login",
    success: true,
    ip,
    sessionId: session.sessionId,
  });

  redirect(next);
}
