import nodemailer, { type Transporter } from "nodemailer";

function getTransporter(): Transporter {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  // No real SMTP credentials available for MVP (same stub pattern as CMI
  // payments, ADR-4) — logs instead of sending, so the code path is still
  // real and testable, and swapping in real SMTP later is a one-line env change.
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendAlertEmail(
  shipmentId: string,
  reason: string,
  value: number,
  threshold: number,
): Promise<void> {
  const info = await getTransporter().sendMail({
    from: process.env.ALERT_EMAIL_FROM ?? "alerts@baridi.ma",
    to: process.env.ALERT_EMAIL_TO ?? "ops@baridi.ma",
    subject: `Cold-chain alert: ${reason} on shipment ${shipmentId}`,
    text: `Reading ${value} breached threshold ${threshold} (${reason}) for shipment ${shipmentId}.`,
  });
  if (!process.env.SMTP_HOST) {
    console.log("[alerting] SMTP not configured — email not actually sent:", info.message?.toString());
  }
}
