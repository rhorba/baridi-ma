import { test, expect } from "@playwright/test";
import mqtt from "mqtt";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";

test("live tracking chart and alerts update in the browser after a real sensor reading", async ({ page, request }) => {
  const runId = Date.now();
  const shipperEmail = `e2e-alert-shipper-${runId}@example.com`;
  const receiverEmail = `e2e-alert-receiver-${runId}@example.com`;

  const receiverRes = await request.post(`${AUTH_SERVICE_URL}/auth/register`, {
    data: { email: receiverEmail, password: "correcthorsebattery", name: "E2E Receiver", role: "receiver" },
  });
  expect(receiverRes.ok()).toBe(true);

  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("E2E Alert Shipper");
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

  // The one-time device-token reveal banner is what makes the simulator usable by a real user.
  await expect(page.getByText("Device token (shown once — save it now)")).toBeVisible();
  const deviceToken = await page.locator("p.font-mono").textContent();
  expect(deviceToken).toBeTruthy();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Device token (shown once — save it now)")).not.toBeVisible();

  // Publish a real breaching reading over MQTT — same broker the app uses, not a mock.
  const mqttClient = mqtt.connect(MQTT_BROKER_URL);
  await new Promise<void>((resolve) => mqttClient.on("connect", () => resolve()));
  mqttClient.publish("sensors/e2e/readings", JSON.stringify({ deviceToken, temperatureC: 15, humidityPct: 55 }));
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await mqttClient.endAsync();

  await page.reload();

  await expect(page.getByText("Temperature history")).toBeVisible();
  await expect(page.getByText("Temperature too high")).toBeVisible();
  await expect(page.getByText(/15.*threshold 8/)).toBeVisible();
});
