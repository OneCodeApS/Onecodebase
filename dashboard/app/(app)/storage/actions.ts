"use server";

import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { minio } from "@/lib/minio";
import {
  getBucketPolicy,
  mimeAllowed,
  setBucketPolicy,
  type BucketPolicy,
  type Visibility,
} from "@/lib/storage";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { signObjectUrl } from "@/lib/storage-signing";

// S3 bucket name rules: 3-63 chars, lowercase, digits, hyphens. Must begin
// and end with a letter or digit. We're stricter than S3 (no periods).
const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

async function requireSession() {
  const s = await getSession();
  if (!s.userId) redirect("/login");
  return s;
}

async function requireWritable() {
  const s = await requireSession();
  if (s.role === "read_only") {
    throw new Error("Read-only users cannot modify storage");
  }
  return s;
}

async function requireAdmin() {
  const s = await requireSession();
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

export async function createBucket(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().toLowerCase();
  const ip = await clientIp();

  if (!BUCKET_NAME.test(name)) {
    redirect("/storage?error=" + encodeURIComponent(
      "Bucket name must be 3-63 chars, lowercase letters/digits/hyphens, and start+end with a letter or digit",
    ));
  }

  let errMsg: string | null = null;
  try {
    await minio.makeBucket(name);
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.bucket.create",
    target: name,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: errMsg ? { error: errMsg } : {},
  });

  if (errMsg) {
    redirect("/storage?error=" + encodeURIComponent(errMsg));
  }
  revalidatePath("/storage", "layout");
  redirect(`/storage/${name}`);
}

export async function deleteBucket(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const ip = await clientIp();

  let errMsg: string | null = null;
  try {
    await minio.removeBucket(name);
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.bucket.delete",
    target: name,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: errMsg ? { error: errMsg } : {},
  });

  if (errMsg) {
    redirect(`/storage/${name}?error=${encodeURIComponent(errMsg)}`);
  }
  revalidatePath("/storage", "layout");
  redirect("/storage");
}

export async function uploadObject(formData: FormData) {
  const session = await requireWritable();
  const bucket = String(formData.get("bucket") ?? "");
  const file = formData.get("file") as File | null;
  const ip = await clientIp();

  if (!file || file.size === 0) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent("No file selected")}`);
  }

  // Load policy and validate the file BEFORE streaming it to MinIO. Each
  // failed validation gets an audit row with the reason so attempts are
  // visible without scanning logs.
  const policy = await getBucketPolicy(bucket);
  const sizeMb = file!.size / (1024 * 1024);
  const contentType = file!.type || "application/octet-stream";

  let validationError: string | null = null;
  if (sizeMb > policy.max_upload_mb) {
    validationError = `File is ${sizeMb.toFixed(1)} MB; bucket allows up to ${policy.max_upload_mb} MB.`;
  } else if (!mimeAllowed(contentType, policy.allowed_mime)) {
    validationError = `Content type "${contentType}" is not allowed for this bucket.`;
  }

  if (validationError) {
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: session.role!,
      action: "storage.object.upload",
      target: `${bucket}/${file!.name}`,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: {
        bucket,
        name: file!.name,
        size: file!.size,
        content_type: contentType,
        reason: "policy_violation",
        detail: validationError,
      },
    });
    redirect(`/storage/${bucket}?error=${encodeURIComponent(validationError)}`);
  }

  let errMsg: string | null = null;
  try {
    const buffer = Buffer.from(await file!.arrayBuffer());
    await minio.putObject(bucket, file!.name, buffer, file!.size, {
      "Content-Type": contentType,
    });
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.object.upload",
    target: `${bucket}/${file?.name ?? "?"}`,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: {
      bucket,
      name: file?.name,
      size: file?.size,
      content_type: contentType,
      ...(errMsg ? { error: errMsg } : {}),
    },
  });

  if (errMsg) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent(errMsg)}`);
  }
  revalidatePath(`/storage/${bucket}`);
  redirect(`/storage/${bucket}?ok=${encodeURIComponent(`Uploaded ${file!.name}`)}`);
}

export async function deleteObject(formData: FormData) {
  const session = await requireWritable();
  const bucket = String(formData.get("bucket") ?? "");
  const name = String(formData.get("name") ?? "");
  const ip = await clientIp();

  let errMsg: string | null = null;
  try {
    await minio.removeObject(bucket, name);
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.object.delete",
    target: `${bucket}/${name}`,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: errMsg ? { error: errMsg } : {},
  });

  if (errMsg) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent(errMsg)}`);
  }
  revalidatePath(`/storage/${bucket}`);
  redirect(`/storage/${bucket}?ok=${encodeURIComponent(`Deleted ${name}`)}`);
}

// Admin-updates the dashboard-side policy AND mirrors it to MinIO. If the
// MinIO policy update fails, the DB write is kept (so the UI reflects the
// intent) and the user sees an error — usually it just needs MinIO to be
// reachable / the bucket to exist.
export async function updateBucketPolicy(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const bucket = String(formData.get("bucket") ?? "");
  const visibility = String(formData.get("visibility") ?? "private") as Visibility;
  const maxMb = Number(formData.get("max_upload_mb") ?? 25);
  const rawMime = String(formData.get("allowed_mime") ?? "").trim();
  const allowedMime = rawMime
    ? rawMime.split(/\s*,\s*/).filter((s) => s.length > 0)
    : null;

  if (!["public", "private"].includes(visibility)) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent("Invalid visibility")}`);
  }
  if (!Number.isInteger(maxMb) || maxMb <= 0 || maxMb > 5000) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent("Max MB must be a positive integer ≤ 5000")}`);
  }

  const policy: BucketPolicy = {
    bucket,
    visibility,
    max_upload_mb: maxMb,
    allowed_mime: allowedMime,
  };

  let errMsg: string | null = null;
  try {
    await setBucketPolicy(policy, session.userId ?? null);
    // No mirror to MinIO any more: every request goes through the
    // /storage/v1 dashboard proxy, which is the canonical authorization
    // gate. MinIO stays internally accessible only via dashboard-issued
    // SigV4 URLs; whether a bucket is "public" is enforced by the proxy's
    // /storage/v1/object/public/* route checking this row.
    await minio.setBucketPolicy(bucket, "");
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.bucket.policy",
    target: bucket,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: {
      visibility,
      max_upload_mb: maxMb,
      allowed_mime: allowedMime,
      ...(errMsg ? { error: errMsg } : {}),
    },
  });

  if (errMsg) {
    redirect(`/storage/${bucket}?error=${encodeURIComponent(errMsg)}`);
  }
  revalidatePath(`/storage/${bucket}`);
  redirect(`/storage/${bucket}?ok=${encodeURIComponent("Policy updated")}`);
}

// Returns a sharable URL for the object. Both visibility modes now go
// through the /storage/v1 proxy on api.<host>:
//   - public  → /storage/v1/object/public/<bucket>/<key>  (no token)
//   - private → /storage/v1/object/sign/<bucket>/<key>?token=…&expires=…
// Either URL is opaque to the recipient — the dashboard decides per-request
// whether to 302 to MinIO. Audited so leaked links are traceable.
export async function getShareLink(
  bucket: string,
  name: string,
  expirySeconds = 3600,
): Promise<{ url: string; visibility: Visibility; expiresAt: string | null }> {
  const session = await requireSession();
  const ip = await clientIp();

  const policy = await getBucketPolicy(bucket);
  const apiBaseUrl = (process.env.API_PUBLIC_URL ?? "").replace(/\/+$/, "");

  let url: string;
  let expiresAt: string | null = null;

  if (policy.visibility === "public") {
    const encodedKey = name.split("/").map(encodeURIComponent).join("/");
    url = `${apiBaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedKey}`;
  } else {
    const signed = signObjectUrl({
      apiBaseUrl,
      bucket,
      key: name,
      expiresInSeconds: expirySeconds,
    });
    url = signed.url;
    expiresAt = signed.expires_at;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: session.role!,
    action: "storage.object.share",
    target: `${bucket}/${name}`,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: {
      bucket,
      name,
      visibility: policy.visibility,
      expires_at: expiresAt,
    },
  });

  return { url, visibility: policy.visibility, expiresAt };
}
