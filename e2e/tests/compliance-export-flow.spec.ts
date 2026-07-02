import { test, expect } from "@playwright/test";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

test("receiver exports a compliance PDF once a shipment is delivered", async ({ page, request }) => {
  const runId = Date.now();
  const shipperEmail = `e2e-compliance-shipper-${runId}@example.com`;
  const receiverEmail = `e2e-compliance-receiver-${runId}@example.com`;
  const carrierEmail = `e2e-compliance-carrier-${runId}@example.com`;

  // Receiver and carrier accounts are setup data, not what this test verifies — create via API.
  for (const [email, role] of [
    [receiverEmail, "receiver"],
    [carrierEmail, "carrier"],
  ] as const) {
    const res = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
      data: { email, password: "correcthorsebattery", name: `E2E ${role}`, role },
    });
    expect(res.ok()).toBe(true);
  }

  // Shipper: exercise the real UI, same pattern as shipment-flow.spec.ts.
  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("E2E Compliance Shipper");
  await page.getByPlaceholder("Email").fill(shipperEmail);
  await page.getByPlaceholder(/Password/).fill("correcthorsebattery");
  await page.getByRole("combobox").selectOption("shipper");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(shipperEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/shipments/new");
  await page.getByPlaceholder("Product type (e.g. Dairy)").fill("Vaccine");
  await page.getByPlaceholder("Origin").fill("Casablanca");
  await page.getByPlaceholder("Destination").fill("Rotterdam");
  await page.getByPlaceholder("Receiver email").fill(receiverEmail);
  await page.getByPlaceholder("Min °C").fill("2");
  await page.getByPlaceholder("Max °C").fill("8");
  await page.getByRole("button", { name: "Create Shipment" }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}\?deviceToken=/);
  const shipmentUrl = page.url().split("?")[0];

  await page.getByPlaceholder("Carrier email").fill(carrierEmail);
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByPlaceholder("Carrier email")).not.toBeVisible();

  // Carrier: move the shipment created -> in_transit -> delivered.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(carrierEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(shipmentUrl);
  await page.getByRole("button", { name: "Mark in transit" }).click();
  await expect(page.getByText("In Transit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();

  // Receiver: the delivered shipment now shows the export button; no such
  // affordance exists for any earlier status (see canExportCompliance in
  // apps/web/app/shipments/[id]/page.tsx).
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(receiverEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(shipmentUrl);
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
  const exportButton = page.getByRole("button", { name: "Export Compliance PDF" });
  await expect(exportButton).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(/^compliance-[0-9a-f-]{36}\.pdf$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(downloadPath!);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

  // Idempotent replay: clicking again re-downloads the same certificate
  // rather than erroring or regenerating (Compliance Service ADR-3).
  const [secondDownload] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  const secondPath = await secondDownload.path();
  const secondBytes = await fs.readFile(secondPath!);
  expect(secondBytes.equals(bytes)).toBe(true);
});
