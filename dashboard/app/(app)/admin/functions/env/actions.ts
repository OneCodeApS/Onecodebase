"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  deleteEnvVar,
  ENV_KEY,
  upsertEnvVar,
} from "@/lib/function-env";

async function requireAdmin() {
  const s = await getSession();
  if (s.role !== "admin") throw new Error("Admin only");
  return s;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function saveEnvVar(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!ENV_KEY.test(key)) {
    redirect(
      "/admin/functions/env?error=" +
        encodeURIComponent("Invalid name — UPPER_SNAKE_CASE only"),
    );
  }

  await upsertEnvVar({ key, value, description }, session.userId ?? null);

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "function_env.update",
    target: key,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    // Don't log the value — could be a secret.
    metadata: { key, has_description: !!description, value_length: value.length },
  });

  revalidatePath("/admin/functions/env");
  redirect("/admin/functions/env?ok=" + encodeURIComponent(`Saved ${key}`));
}

export async function removeEnvVar(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();
  const key = String(formData.get("key") ?? "");
  await deleteEnvVar(key);

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "function_env.delete",
    target: key,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
  });

  revalidatePath("/admin/functions/env");
  redirect("/admin/functions/env?ok=" + encodeURIComponent(`Deleted ${key}`));
}
