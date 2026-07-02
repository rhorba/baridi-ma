import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// forcePathStyle only when a custom endpoint (MinIO, any other S3-compatible
// service) is configured — real AWS S3 uses standard virtual-hosted
// addressing and doesn't need it. Local dev vs. any other environment is an
// env-var difference only, no code change (post-MVP architecture note).
function s3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: !!endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function bucket(): string {
  return process.env.S3_BUCKET ?? "baridi-compliance";
}

export function exportStorageKey(shipmentId: string): string {
  return `${shipmentId}.pdf`;
}

export async function saveExportFile(shipmentId: string, bytes: Uint8Array): Promise<string> {
  const key = exportStorageKey(shipmentId);
  await s3Client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: "application/pdf" }),
  );
  return key;
}

export async function readExportFile(key: string): Promise<Buffer> {
  const res = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
