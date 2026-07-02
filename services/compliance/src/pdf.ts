import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ShipmentDto } from "./shipment-client.js";
import type { ReadingDto } from "./ingestion-client.js";

export async function generateCompliancePdf(
  shipment: ShipmentDto,
  readings: ReadingDto[],
  readingHash: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const line = (text: string, options: { size?: number; useBold?: boolean } = {}) => {
    page.drawText(text, {
      x: 50,
      y,
      size: options.size ?? 11,
      font: options.useBold ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= (options.size ?? 11) + 8;
  };

  line("Baridi.ma — Cold Chain Compliance Certificate", { size: 16, useBold: true });
  y -= 10;
  line(`Shipment ID: ${shipment.id}`);
  line(`Product: ${shipment.productType}`);
  line(`Route: ${shipment.origin} -> ${shipment.destination}`);
  line(`Required range: ${shipment.tempMinC}C - ${shipment.tempMaxC}C`);
  line(`Status: ${shipment.status}`);
  y -= 10;
  line(`Reading count: ${readings.length}`, { useBold: true });
  line(`SHA-256 reading hash: ${readingHash}`, { size: 9 });
  line(`Generated at: ${new Date().toISOString()}`);

  return doc.save();
}
