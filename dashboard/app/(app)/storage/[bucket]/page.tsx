import { notFound } from "next/navigation";
import { minio } from "@/lib/minio";
import { getSession } from "@/lib/session";
import { getBucketPolicy } from "@/lib/storage";
import { Card } from "../../_components/Card";
import { deleteBucket, uploadObject } from "../actions";
import { ObjectList } from "./_components/ObjectList";
import { SettingsModal } from "./_components/SettingsModal";

const SAFE_BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

type ObjectEntry = {
  name: string;
  size: number;
  lastModified: Date;
  etag: string;
};

async function listObjects(bucket: string): Promise<ObjectEntry[]> {
  return new Promise((resolve, reject) => {
    const items: ObjectEntry[] = [];
    const stream = minio.listObjectsV2(bucket, "", true);
    stream.on("data", (obj) => {
      if (obj.name) {
        items.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag,
        });
      }
    });
    stream.on("end", () => resolve(items));
    stream.on("error", reject);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default async function BucketPage({
  params,
  searchParams,
}: {
  params: Promise<{ bucket: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { bucket: rawBucket } = await params;
  const sp = await searchParams;
  const bucket = decodeURIComponent(rawBucket);

  if (!SAFE_BUCKET.test(bucket)) notFound();

  const session = await getSession();
  const canWrite = session.role !== "read_only";
  const isAdmin = session.role === "admin";

  let exists = true;
  try {
    exists = await minio.bucketExists(bucket);
  } catch {
    // Surface as not found rather than crashing the page.
    exists = false;
  }
  if (!exists) notFound();

  const [objects, policy] = await Promise.all([
    listObjects(bucket),
    getBucketPolicy(bucket),
  ]);
  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              <span className="font-mono">{bucket}</span>
            </h1>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${
                policy.visibility === "public"
                  ? "border-amber-900/50 bg-amber-950/30 text-amber-300"
                  : "border-neutral-700 bg-neutral-800/40 text-neutral-300"
              }`}
              title={
                policy.visibility === "public"
                  ? "Anyone with a link can read every object"
                  : "Requires a signed share link or dashboard auth"
              }
            >
              {policy.visibility}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {objects.length} {objects.length === 1 ? "object" : "objects"} ·{" "}
            {formatSize(totalSize)} · max upload {policy.max_upload_mb} MB
            {policy.allowed_mime && policy.allowed_mime.length > 0 && (
              <> · allowed: {policy.allowed_mime.join(", ")}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <SettingsModal policy={policy} />}
          {isAdmin && objects.length === 0 && (
            <form action={deleteBucket}>
              <input type="hidden" name="name" value={bucket} />
              <button
                type="submit"
                className="rounded border border-red-900/50 px-3 py-1 text-sm text-red-300 hover:bg-red-950/40"
              >
                Delete bucket
              </button>
            </form>
          )}
        </div>
      </div>

      {sp.error && (
        <p className="mt-3 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {sp.error}
        </p>
      )}
      {sp.ok && (
        <p className="mt-3 rounded border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {sp.ok}
        </p>
      )}

      {canWrite && (
        <Card padded className="mt-6">
          <h2 className="text-lg font-medium">Upload</h2>
          <form
            action={uploadObject}
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="bucket" value={bucket} />
            <input
              type="file"
              name="file"
              required
              className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded file:border file:border-neutral-700 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
            />
            <button
              type="submit"
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Upload
            </button>
          </form>
        </Card>
      )}

      <Card className="mt-6 overflow-x-auto">
        <ObjectList bucket={bucket} objects={objects} canWrite={canWrite} />
      </Card>
    </main>
  );
}
