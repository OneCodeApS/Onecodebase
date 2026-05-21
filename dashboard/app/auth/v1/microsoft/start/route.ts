import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { microsoftAuthorizeUrl } from "@/lib/auth-oauth-microsoft";
import { isProviderEnabled } from "@/lib/auth-settings";

// Starts the Microsoft OAuth code flow. Optional `?return_to=<absolute-url>`
// is round-tripped through `state` so the callback can hand control back to
// the calling app. We also remember it server-side via a cookie so the
// callback can validate the state didn't get tampered with.
//
// Usage from a client app:
//   window.location = 'https://api.example.com/auth/v1/microsoft/start?return_to=https://myapp/cb'
export async function GET(req: NextRequest) {
  if (!(await isProviderEnabled("microsoft"))) {
    return NextResponse.json(
      { error: "microsoft_provider_disabled" },
      { status: 403 },
    );
  }
  const returnTo = req.nextUrl.searchParams.get("return_to") ?? "";
  // `state` is a random nonce + the base64-encoded return_to so we don't have
  // to keep server-side state across the redirect.
  const nonce = crypto.randomBytes(16).toString("hex");
  const encoded = Buffer.from(returnTo).toString("base64url");
  const state = `${nonce}.${encoded}`;

  const url = await microsoftAuthorizeUrl(state);
  const res = NextResponse.redirect(url);
  // HttpOnly cookie holds the nonce so the callback can confirm the round trip.
  // 10-minute window — enough for a user to complete the login.
  res.cookies.set("auth_ms_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/auth/v1/microsoft",
  });
  return res;
}
