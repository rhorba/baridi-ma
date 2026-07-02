import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "compliance-storage-test-"));
  process.env.COMPLIANCE_STORAGE_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.COMPLIANCE_STORAGE_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("storage", () => {
  it("saves a file and reads back identical bytes", async () => {
    const { saveExportFile, readExportFile, exportFilePath } = await import("../src/storage.js");
    const shipmentId = "11111111-1111-1111-1111-111111111111";
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const filePath = await saveExportFile(shipmentId, bytes);
    expect(filePath).toBe(exportFilePath(shipmentId));

    const readBack = await readExportFile(filePath);
    expect(Array.from(readBack)).toEqual([1, 2, 3, 4]);
  });

  it("creates the storage directory if it doesn't exist yet", async () => {
    const { saveExportFile } = await import("../src/storage.js");
    process.env.COMPLIANCE_STORAGE_DIR = path.join(tmpDir, "nested", "dir");
    const filePath = await saveExportFile("22222222-2222-2222-2222-222222222222", new Uint8Array([9]));
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });
});
