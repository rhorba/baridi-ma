import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn().mockResolvedValue({ message: "mock-message" });
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));

import { sendAlertEmail } from "../src/mailer.js";

beforeEach(() => {
  sendMailMock.mockClear();
  createTransportMock.mockClear();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
});

describe("sendAlertEmail", () => {
  it("uses the logging (jsonTransport) fallback when SMTP_HOST is not set", async () => {
    await sendAlertEmail("shipment-1", "temp_high", 10, 8);
    expect(createTransportMock).toHaveBeenCalledWith({ jsonTransport: true });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("temp_high") }));
  });

  it("uses real SMTP config when SMTP_HOST is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASSWORD = "pass";

    await sendAlertEmail("shipment-1", "temp_high", 10, 8);

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 465, secure: true, auth: { user: "user", pass: "pass" } }),
    );
  });

  it("omits auth when SMTP is configured without a user", async () => {
    process.env.SMTP_HOST = "smtp.example.com";

    await sendAlertEmail("shipment-1", "temp_high", 10, 8);

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });
});
