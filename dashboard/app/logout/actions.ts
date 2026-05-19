"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function logout() {
  const session = await getSession();
  const actor = session.email;
  session.destroy();
  if (actor) {
    await audit({ actor, action: "logout" });
  }
  redirect("/login");
}
