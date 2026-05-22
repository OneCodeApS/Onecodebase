import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { minio } from "@/lib/minio";
import { getSession } from "@/lib/session";

// Streams an object through the dashboard rather than presigning a URL the
// browser hits directly. This sidesteps the "MinIO endpoint isn't reachable
// from the browser" problem (Caddy proxies files.* in prod, dev relies on
// 127.0.0.1:9000) and keeps the auth check in one place.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bucket: string }> },
) {
  const session = await getSession();
  if (!session.userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { bucket } = await params;
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return new NextResponse("Missing 'name' parameter", { status: 400 });
  }

  try {
    const stat = await minio.statObject(bucket, name);
    const stream = await minio.getObject(bucket, name);

    const contentType =
      stat.metaData?.["content-type"] ?? "application/octet-stream";
    const safeFilename = encodeURIComponent(name);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Length": String(stat.size),
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFilename}`,
      },
    });
  } catch (e) {
    const msg = (e as Error).message || "Download failed";
    return new NextResponse(msg, { status: 404 });
  }
}
