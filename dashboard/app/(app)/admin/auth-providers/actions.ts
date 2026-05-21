"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  getProvider,
  setAuthSettings,
  setProvider,
  type AuthSettings,
} from "@/lib/auth-settings";

async function requireAdmin() {
  const s = await getSession();
  if (s.role !== "admin") {
    throw new Error("Admin only");
  }
  return s;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function updateAuthSettings(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const next: AuthSettings = {
    allow_signups: formData.get("allow_signups") === "on",
    confirm_email: formData.get("confirm_email") === "on",
  };

  await setAuthSettings(next, session.userId ?? null);
  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "auth.settings.update",
    target: "auth.settings",
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: next as unknown as Record<string, unknown>,
  });

  revalidatePath("/admin/auth-providers");
  redirect("/admin/auth-providers?ok=" + encodeURIComponent("Settings saved"));
}

export async function updateProvider(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const name = String(formData.get("name") ?? "");
  const enabled = formData.get("enabled") === "on";

  // Load existing config so empty fields don't wipe secrets that are already
  // set. For the client secret in particular, we only overwrite if the admin
  // typed a non-empty value.
  const existing = await getProvider(name);
  const existingCfg = (existing?.config ?? {}) as Record<string, unknown>;
  let nextConfig: Record<string, unknown> | undefined;

  if (name === "microsoft") {
    const clientId = String(formData.get("client_id") ?? "").trim();
    const clientSecretRaw = String(formData.get("client_secret") ?? "");
    const tenant = String(formData.get("tenant") ?? "").trim();
    nextConfig = {
      ...existingCfg,
      client_id: clientId || existingCfg.client_id || "",
      tenant: tenant || existingCfg.tenant || "common",
    };
    if (clientSecretRaw.length > 0) {
      nextConfig.client_secret = clientSecretRaw;
    }
  }

  await setProvider(name, { enabled, config: nextConfig }, session.userId ?? null);

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "auth.provider.update",
    target: name,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: {
      provider: name,
      enabled,
      // Don't log secret contents — flag whether one was supplied this round.
      client_secret_changed:
        nextConfig && "client_secret" in nextConfig
          ? !!(nextConfig.client_secret as string)?.length &&
            nextConfig.client_secret !== existingCfg.client_secret
          : false,
    },
  });

  revalidatePath("/admin/auth-providers");
  redirect(
    "/admin/auth-providers?ok=" +
      encodeURIComponent(`${name} provider saved`),
  );
}
