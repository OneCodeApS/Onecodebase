"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { findAdminByEmail, getSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Only allow same-host redirects so a crafted ?next= can't bounce off-site.
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

  const admin = await findAdminByEmail(email);
  const ok = admin ? await verifyPassword(admin.password_hash, password) : false;

  const ip = await clientIp();

  if (!admin || !ok) {
    await audit({
      actor: email || "<unknown>",
      action: "login",
      success: false,
      ip,
      metadata: { reason: admin ? "bad_password" : "unknown_email" },
    });
    redirect(`/login?error=${encodeURIComponent("Invalid email or password")}`);
  }

  const session = await getSession();
  session.adminId = admin.id;
  session.email = admin.email;
  session.csrf = randomBytes(32).toString("hex");
  await session.save();

  await audit({ actor: admin.email, action: "login", success: true, ip });

  redirect(next);
}
