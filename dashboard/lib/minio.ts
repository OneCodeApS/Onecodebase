import { Client } from "minio";

declare global {
  // eslint-disable-next-line no-var
  var __minioClient: Client | undefined;
}

function buildClient(): Client {
  const endPoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!endPoint || !accessKey || !secretKey) {
    throw new Error("MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY must be set");
  }
  return new Client({
    endPoint,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey,
    secretKey,
  });
}

export const minio: Client = globalThis.__minioClient ?? buildClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__minioClient = minio;
}
