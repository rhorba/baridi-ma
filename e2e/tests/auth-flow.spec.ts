import { test, expect } from "@playwright/test";

// v0.1 critical flow: the only user-facing journey shipped in Sprint 1.
test("register, log in, view dashboard, log out", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByPlaceholder("Full name").fill("E2E Tester");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/Password/).fill("correcthorsebattery");
  await page.getByRole("combobox").selectOption("shipper");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Welcome, E2E Tester")).toBeVisible();
  await expect(page.getByText("Role: shipper")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
