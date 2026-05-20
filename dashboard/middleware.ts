import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type Session } from "./lib/session";

// Routes that anonymous users can reach.
const PUBLIC_PATHS = new Set<string>(["/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<Session>(req, res, sessionOptions());

  if (!session.adminId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Skip static and Next internals; everything else passes through.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
