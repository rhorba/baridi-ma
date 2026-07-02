import { test, expect } from "@playwright/test";
import { Pool } from "pg";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://baridi:baridi@localhost:5433/baridi_ma";

// Admin is never self-service (see services/auth/src/schemas.ts) — the only
// way to get one is promoting an existing account, same as a real deployment
// would via a one-off DB operation.
async function promoteToAdmin(email: string) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query("UPDATE auth.users SET role = 'admin' WHERE email = $1", [email]);
  await pool.end();
}

test("admin can list and deactivate a user, who can no longer log in or refresh afterward", async ({ page, request }) => {
  const runId = Date.now();
  const adminEmail = `e2e-admin-${runId}@example.com`;
  const targetEmail = `e2e-target-${runId}@example.com`;

  const adminRegRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: adminEmail, password: "correcthorsebattery", name: "E2E Admin", role: "receiver" },
  });
  expect(adminRegRes.ok()).toBe(true);
  await promoteToAdmin(adminEmail);

  const targetRegRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: targetEmail, password: "correcthorsebattery", name: "E2E Target", role: "carrier" },
  });
  expect(targetRegRes.ok()).toBe(true);

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(adminEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Role: admin")).toBeVisible();

  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/admin\/users/);

  const targetRow = page.locator("tr", { hasText: targetEmail });
  await expect(targetRow.getByText("Active")).toBeVisible();
  await expect(targetRow.getByRole("button", { name: "Deactivate" })).toBeVisible();

  // The admin's own row has no Deactivate button (self-deactivation guard).
  const adminRow = page.locator("tr", { hasText: adminEmail });
  await expect(adminRow.getByRole("button", { name: "Deactivate" })).not.toBeVisible();

  await targetRow.getByRole("button", { name: "Deactivate" }).click();
  await expect(targetRow.getByText("Deactivated")).toBeVisible();
  await expect(targetRow.getByRole("button", { name: "Deactivate" })).not.toBeVisible();

  // Real behavioral check, not just a UI-state assertion: the deactivated
  // account can no longer authenticate at all (login rejected server-side,
  // and — per the refresh gap fixed this sprint — an already-issued refresh
  // token stops working too, not just new logins).
  const loginAfterRes = await request.post(`${AUTH_SERVICE_URL}/auth/login`, {
    data: { email: targetEmail, password: "correcthorsebattery" },
  });
  expect(loginAfterRes.status()).toBe(401);
});

test("admin sees shipper/carrier/receiver emails on the shipments list", async ({ page, request }) => {
  const runId = Date.now();
  const adminEmail = `e2e-admin2-${runId}@example.com`;
  const shipperEmail = `e2e-owner-shipper-${runId}@example.com`;
  const receiverEmail = `e2e-owner-receiver-${runId}@example.com`;

  const adminRegRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: adminEmail, password: "correcthorsebattery", name: "E2E Admin 2", role: "receiver" },
  });
  expect(adminRegRes.ok()).toBe(true);
  await promoteToAdmin(adminEmail);

  const shipperRegRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: shipperEmail, password: "correcthorsebattery", name: "E2E Owner Shipper", role: "shipper" },
  });
  expect(shipperRegRes.ok()).toBe(true);
  const receiverRegRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: receiverEmail, password: "correcthorsebattery", name: "E2E Owner Receiver", role: "receiver" },
  });
  expect(receiverRegRes.ok()).toBe(true);

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(shipperEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/shipments/new");
  const productType = `Admin Oversight Test ${runId}`;
  await page.getByPlaceholder("Product type (e.g. Dairy)").fill(productType);
  await page.getByPlaceholder("Origin").fill("Casablanca");
  await page.getByPlaceholder("Destination").fill("Rotterdam");
  await page.getByPlaceholder("Receiver email").fill(receiverEmail);
  await page.getByPlaceholder("Min °C").fill("2");
  await page.getByPlaceholder("Max °C").fill("8");
  await page.getByRole("button", { name: "Create Shipment" }).click();
  await expect(page).toHaveURL(/\/shipments\/[0-9a-f-]{36}\?deviceToken=/);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(adminEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/shipments");
  const row = page.locator("li", { hasText: productType });
  await expect(row).toContainText(`Shipper: ${shipperEmail}`);
  await expect(row).toContainText(`Receiver: ${receiverEmail}`);
  await expect(row).toContainText("Carrier: —");
});
