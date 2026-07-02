import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";

let sendSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.S3_BUCKET = "test-bucket";
  process.env.S3_ENDPOINT = "http://minio-test:9000";
  sendSpy = vi.spyOn(S3Client.prototype, "send");
});

afterEach(() => {
  sendSpy.mockRestore();
  delete process.env.S3_BUCKET;
  delete process.env.S3_ENDPOINT;
});

describe("exportStorageKey", () => {
  it("derives a predictable key from the shipment id", async () => {
    const { exportStorageKey } = await import("../src/storage.js");
    expect(exportStorageKey("11111111-1111-1111-1111-111111111111")).toBe("11111111-1111-1111-1111-111111111111.pdf");
  });
});

describe("saveExportFile", () => {
  it("PUTs the bytes to the configured bucket/key and returns the key", async () => {
    sendSpy.mockResolvedValue({});
    const { saveExportFile } = await import("../src/storage.js");

    const key = await saveExportFile("shipment-1", new Uint8Array([1, 2, 3]));

    expect(key).toBe("shipment-1.pdf");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const command = sendSpy.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "shipment-1.pdf", // gitleaks:allow (S3 object key, not a secret — false-positive generic-api-key match)
      ContentType: "application/pdf",
    });
  });
});

describe("readExportFile", () => {
  it("GETs the object and streams its body into a Buffer", async () => {
    async function* fakeBody() {
      yield new Uint8Array([1, 2]);
      yield new Uint8Array([3]);
    }
    sendSpy.mockResolvedValue({ Body: fakeBody() });
    const { readExportFile } = await import("../src/storage.js");

    const buf = await readExportFile("shipment-1.pdf");

    expect(Array.from(buf)).toEqual([1, 2, 3]);
    const command = sendSpy.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({ Bucket: "test-bucket", Key: "shipment-1.pdf" }); // gitleaks:allow (S3 object key, not a secret)
  });
});
