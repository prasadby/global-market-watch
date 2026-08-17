import { test, expect } from "@playwright/test";

test.describe("Global Market Watch — production regressions", () => {
  test("loads the market watch without the removed cockpit/dashboard", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("MARKET COCKPIT", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Market Cockpit", { exact: false })).toHaveCount(0);
    await expect(page.locator(".marketDashboard")).toHaveCount(0);
    await expect(page.locator(".dashboardKpis")).toHaveCount(0);
    await expect(page.locator(".dashboardCard")).toHaveCount(0);

    await expect(page.getByText("GLOBAL MARKET STATUS", { exact: true })).toBeVisible();
  });

  test("configuration opens without exposing the removed cockpit setting", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /configure/i }).click();

    await expect(page.getByText(/market cockpit/i)).toHaveCount(0);
    await expect(page.getByText(/market dashboard/i)).toHaveCount(0);
    await expect(page.locator("label").filter({ hasText: /dashboard|cockpit/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /configure market watch/i })).toBeVisible();
  });

  test("configuration retains the core settings areas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /configure/i }).click();

    await expect(page.getByText("Workspace", { exact: true })).toBeVisible();
    await expect(page.getByText("Refresh", { exact: true })).toBeVisible();
    await expect(page.getByText("Watchlist", { exact: true })).toBeVisible();
    await expect(page.getByText("Portfolio", { exact: true })).toBeVisible();
    await expect(page.getByText("Price alerts", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /save changes/i })).toBeVisible();
  });
});
