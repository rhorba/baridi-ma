import { test, expect } from "@playwright/test";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

test("shipper creates a shipment via the UI and sees it in the list and detail view", async ({ page, request }) => {
  const runId = Date.now();
  const shipperEmail = `e2e-shipper-${runId}@example.com`;
  const receiverEmail = `e2e-receiver-${runId}@example.com`;

  // Receiver account is setup data, not what this test is verifying — create via API.
  const receiverRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: receiverEmail, password: "correcthorsebattery", name: "E2E Receiver", role: "receiver" },
  });
  expect(receiverRes.ok()).toBe(true);

  // Shipper account: exercise the real UI, same as the auth-flow test.
  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("E2E Shipper");
  await page.getByPlaceholder("Email").fill(shipperEmail);
  await page.getByPlaceholder(/Password/).fill("correcthorsebattery");
  await page.getByRole("combobox").selectOption("shipper");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(shipperEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "View Shipments" }).click();
  await expect(page).toHaveURL(/\/shipments$/);
  await expect(page.getByText(/No shipments yet/)).toBeVisible();

  await page.getByRole("link", { name: "+ New Shipment" }).click();
  await expect(page).toHaveURL(/\/shipments\/new/);
  await page.getByPlaceholder("Product type (e.g. Dairy)").fill("Dairy");
  await page.getByPlaceholder("Origin").fill("Casablanca");
  await page.getByPlaceholder("Destination").fill("Rotterdam");
  await page.getByPlaceholder("Receiver email").fill(receiverEmail);
  await page.getByPlaceholder("Min °C").fill("2");
  await page.getByPlaceholder("Max °C").fill("8");
  await page.getByRole("button", { name: "Create Shipment" }).click();

  // Redirects to the detail page for the new shipment (with a one-time
  // device-token reveal in the query string — see alerting-flow.spec.ts).
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}\?deviceToken=/);
  await expect(page.getByRole("heading", { name: "Dairy" })).toBeVisible();
  await expect(page.getByText("Casablanca → Rotterdam")).toBeVisible();
  await expect(page.getByText("Created", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "← Shipments" }).click();
  await expect(page).toHaveURL(/\/shipments$/);
  await expect(page.getByText("Dairy")).toBeVisible();
  await expect(page.getByText("Casablanca → Rotterdam")).toBeVisible();

  // Assign a carrier via the on-page form, then verify the carrier's own
  // status-transition UI (separate role, separate conditional branch).
  const carrierEmail = `e2e-carrier-${runId}@example.com`;
  const carrierRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: carrierEmail, password: "correcthorsebattery", name: "E2E Carrier", role: "carrier" },
  });
  expect(carrierRes.ok()).toBe(true);

  await page.getByText("Dairy").click();
  await page.getByPlaceholder("Carrier email").fill(carrierEmail);
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByPlaceholder("Carrier email")).not.toBeVisible();
  const shipmentUrl = page.url();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(carrierEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(shipmentUrl);
  await expect(page.getByRole("button", { name: "Mark in transit" })).toBeVisible();
  await page.getByRole("button", { name: "Mark in transit" }).click();
  await expect(page.getByText("In Transit", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark delivered" })).toBeVisible();
});
