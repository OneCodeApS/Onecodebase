import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type Session } from "./lib/session";

const PUBLIC_PATHS = new Set<string>(["/login"]);

// Paths that require role=admin. Guests on these get 404 (not 403) so
// the existence of admin pages isn't advertised.
function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// End-user auth API — public, called by external apps with their own bearer
// token (or no token, for sign-up / sign-in). Dashboard session is irrelevant
// here.
function isPublicAuthApi(pathname: string): boolean {
  return pathname.startsWith("/auth/v1/");
}

// Realtime SSE stream — authenticates via Bearer token / ?token= itself, no
// dashboard session needed.
function isRealtimeApi(pathname: string): boolean {
  return pathname === "/realtime" || pathname.startsWith("/realtime/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    isPublicAuthApi(pathname) ||
    isRealtimeApi(pathname)
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<Session>(req, res, sessionOptions());

  if (!session.userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminPath(pathname) && session.role !== "admin") {
    return new NextResponse("Not Found", { status: 404 });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
