import { minio } from "@/lib/minio";
import { getSession } from "@/lib/session";
import { BucketsSidebar, type BucketEntry } from "./_components/BucketsSidebar";

async function listBuckets(): Promise<BucketEntry[]> {
  try {
    const buckets = await minio.listBuckets();
    return buckets.map((b) => ({ name: b.name, creationDate: b.creationDate }));
  } catch (e) {
    // MinIO unreachable — show empty sidebar; the bucket page will surface
    // the real error if the user tries to do something.
    console.error("listBuckets failed:", e);
    return [];
  }
}

export default async function StorageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [buckets, session] = await Promise.all([listBuckets(), getSession()]);
  return (
    <div className="flex min-h-screen">
      <BucketsSidebar buckets={buckets} isAdmin={session.role === "admin"} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
