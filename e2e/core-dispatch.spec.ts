import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const demoLoadId = "25000000-0000-4000-8000-000000000201";
const demoLoadNumber = "DEMO-001";

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
  const locations = page.locator('input[name="stop_location"]');
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

test("explains load-save errors, preserves entries, and allows unknown appointment times", async ({ page }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/loads/new");
  await page.getByLabel("Load Number").fill("E2E-VALIDATION-107");
  const broker = page.locator('select[name="broker_id"]');
  await broker.selectOption({ index: 1 });
  const brokerId = await broker.inputValue();
  await page.getByLabel("Notes").fill("Keep these details after a failed save.");
  await page.locator('input[name="stop_location"]').nth(0).fill("Los Angeles, CA");
  await page.locator('input[name="stop_scheduled_start"]').nth(0).fill("2026-09-28T09:00");
  await page.getByRole("button", { name: "+ Add stop" }).click();
  await page.getByRole("button", { name: "Save load" }).click();

  const alert = page.getByRole("alert", { name: "Load wasn't saved." });
  await expect(alert).toContainText("Load wasn't saved.");
  await expect(alert).toContainText("Stop 2: location: Stop location is required");
  await expect(alert).toContainText("Stop 3: location: Stop location is required");
  await expect(alert).toContainText("Stop 1: appointment end: Add an appointment end time, or skip times for now");
  await expect(alert).toBeFocused();
  await expect(page.getByLabel("Load Number")).toHaveValue("E2E-VALIDATION-107");
  await expect(broker).toHaveValue(brokerId);
  await expect(page.getByLabel("Notes")).toHaveValue("Keep these details after a failed save.");
  await expect(page.locator('select[name="stop_type"]').nth(1)).toHaveValue("Delivery");
  await page.screenshot({ path: testInfo.outputPath("load-validation-feedback.png"), fullPage: true });

  await alert.getByRole("button", { name: /Stop 2: location/ }).click();
  await expect(page.locator('input[name="stop_location"]').nth(1)).toBeFocused();
  await page.locator('input[name="stop_location"]').nth(1).fill("Phoenix, AZ");
  await page.locator('input[name="stop_location"]').nth(2).fill("San Diego, CA");
  await page.getByRole("button", { name: "Skip times for now", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Appointment times skipped" })).toBeVisible();
  await expect(page.locator('input[name="stop_scheduled_start"]').nth(0)).toHaveValue("");
  await expect(page.locator('input[name="stop_scheduled_end"]').nth(0)).toHaveValue("");
  await page.getByRole("button", { name: "Save load" }).click();

  await expect(page).toHaveURL(/\/loads\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Load E2E-VALIDATION-107" })).toBeVisible();
  await expect(page.getByText("Schedule missing").first()).toBeVisible();
});

test("keeps crossover loads with their carrier across dashboard, reports, exports, and invoices", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const [company, ownLoad, otherLoad, revenue] of [
    ["DC", "E2E-DC-CROSS", "E2E-RD-CROSS", "$1,200.00"],
    ["RD", "E2E-RD-CROSS", "E2E-DC-CROSS", "$2,200.00"],
  ]) {
    await page.goto(`/dashboard?company=${company}`);
    await expect(page.getByRole("navigation", { name: "Company scope" }).getByRole("link", { name: company, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('.dashboard-metric').filter({ hasText: "Total revenue" })).toContainText(revenue);
    await expect(page.getByRole("link", { name: new RegExp(ownLoad) }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(otherLoad) })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${company}.png`), fullPage: true });
    await page.getByRole("link", { name: "View all loads" }).click();
    await expect(page).toHaveURL(new RegExp(`company=${company}`));
    await expect(page.getByRole("row").filter({ hasText: ownLoad })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: otherLoad })).toHaveCount(0);

    await page.goto(`/reports?company=${company}&period=all`);
    await expect(page.getByRole("link", { name: ownLoad, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: otherLoad, exact: true })).toHaveCount(0);
    for (const path of ["/api/loads/export", "/api/reports/weekly/export", "/api/reports/exports/client-billing"]) {
      const response = await page.request.get(`${path}?company=${company}&period=all`);
      expect(response.ok()).toBeTruthy();
      const csv = await response.text();
      expect(csv).toContain(ownLoad);
      expect(csv).not.toContain(otherLoad);
    }
    const pdf = await page.request.get(`/api/reports/weekly/pdf?company=${company}&period=all`);
    expect(pdf.ok()).toBeTruthy();
    const pdfBytes = await pdf.body();
    expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
    await writeFile(testInfo.outputPath(`financial-${company}.pdf`), pdfBytes);
    await page.goto(`/invoices/new?company=${company}`);
    await expect(page.getByRole("option", { name: new RegExp(ownLoad) })).toHaveCount(1);
    await expect(page.getByRole("option", { name: new RegExp(otherLoad) })).toHaveCount(0);
  }
  const operationalExport = await page.request.get("/api/loads/export?fleet=RD");
  expect(operationalExport.ok()).toBeTruthy();
  const haulingCsv = await operationalExport.text();
  expect(haulingCsv).toContain("E2E-DC-CROSS");
  expect(haulingCsv).not.toContain("E2E-RD-CROSS");
  await page.goto("/invoices/new?company=DC");
  await page.getByRole("combobox", { name: "Load", exact: true }).selectOption("40000000-0000-4000-8000-000000000201");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/40000000-0000-4000-8000-000000000201$/);
  await page.goto("/invoices?company=DC");
  await expect(page.getByRole("row").filter({ hasText: "E2E-DC-CROSS" })).toContainText("DC");
  await page.goto("/invoices?company=RD");
  await expect(page.getByRole("row").filter({ hasText: "E2E-DC-CROSS" })).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /E2E-DC-CROSS/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E-RD-CROSS/ }).first()).toBeVisible();
});
