import fs from "node:fs/promises";
import path from "node:path";

function storageDir(): string {
  return process.env.COMPLIANCE_STORAGE_DIR ?? "./storage";
}

export function exportFilePath(shipmentId: string): string {
  return path.join(storageDir(), `${shipmentId}.pdf`);
}

export async function saveExportFile(shipmentId: string, bytes: Uint8Array): Promise<string> {
  const filePath = exportFilePath(shipmentId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export async function readExportFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
