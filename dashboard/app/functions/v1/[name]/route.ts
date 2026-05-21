import { NextResponse, type NextRequest } from "next/server";
import {
  executeFunction,
  FUNCTION_NAME,
  getFunction,
} from "@/lib/functions";
import { audit } from "@/lib/audit";

async function handle(
  req: NextRequest,
  params: Promise<{ name: string }>,
): Promise<Response> {
  const { name } = await params;
  if (!FUNCTION_NAME.test(name)) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  const fn = await getFunction(name);
  if (!fn || !fn.enabled) {
    return NextResponse.json({ error: "function_not_found" }, { status: 404 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await executeFunction(fn, req);

  // Audit every invocation so admins can spot misuse / failures without
  // grepping container logs.
  await audit({
    actor: "<edge-function-caller>",
    actorId: null,
    role: null,
    action: "function.invoke",
    target: name,
    success: result.ok,
    ip,
    metadata: {
      method: req.method,
      duration_ms: result.durationMs,
      ...(result.ok
        ? { status: result.response.status }
        : { error: result.error.split("\n")[0] }),
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "function_error", detail: result.error },
      { status: 500 },
    );
  }
  return result.response;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, ctx.params);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, ctx.params);
}
