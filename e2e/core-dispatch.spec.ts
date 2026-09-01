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
