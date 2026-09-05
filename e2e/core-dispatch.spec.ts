import { expect, test } from "@playwright/test";

const demoLoadId = "14000000-0000-4000-8000-000000000001";
const demoLoadNumber = "RD-260717-01";

test("signs in and opens a seeded load from the dashboard", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD are required for the disposable browser fixture.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  const loadLink = page.getByRole("link", { name: new RegExp(demoLoadNumber) }).first();
  await expect(loadLink).toBeVisible();
  await loadLink.click();

  await expect(page).toHaveURL(new RegExp(`/loads/${demoLoadId}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Load ${demoLoadNumber}` })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Load Details" })).toBeVisible();
});

test("creates a load and opens its new invoice page", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD are required for the disposable browser fixture.");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

  await page.goto("/loads/new");
  await page.getByLabel("Load Number").fill("E2E-LOAD-102");
  const locations = page.getByLabel("Location");
  await locations.nth(0).fill("Los Angeles, CA");
  await locations.nth(1).fill("Phoenix, AZ");
  await page.getByRole("button", { name: "Save load" }).click();

  await expect(page).toHaveURL(/\/loads\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Load E2E-LOAD-102" })).toBeVisible();
  await page.getByRole("link", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/new\?load=[0-9a-f-]+$/);

  await page.getByLabel("Status").selectOption("Sent");
  await page.getByLabel("Invoice number").fill("E2E-INV-102");
  await page.getByLabel("Invoice date").fill("2026-09-04");
  await page.getByRole("button", { name: "Create invoice" }).click();

  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Invoice E2E-INV-102" })).toBeVisible();
});
