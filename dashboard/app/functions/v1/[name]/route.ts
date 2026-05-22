import { NextResponse, type NextRequest } from "next/server";
import {
  auditInvocation,
  executeFunction,
  FUNCTION_NAME,
  getFunction,
} from "@/lib/functions";

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

  await auditInvocation(fn, req.method, result, { kind: "http" }, ip);

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
