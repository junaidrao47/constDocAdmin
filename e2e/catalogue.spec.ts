import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./support/helpers";

test.describe("catalogue", () => {
  test("create a category, then a package under it", async ({ page }) => {
    await loginAsAdmin(page);

    const stamp = Date.now();
    const categoryName = `E2E Category ${stamp}`;

    // 1. Create a category.
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "New category" }).click();
    await page.getByLabel("Slug").fill(`e2e-${stamp}`);
    await page.getByLabel("Name (English)").fill(categoryName);
    await page.getByLabel("Name (Spanish)").fill(`Categoría E2E ${stamp}`);
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    // 2. Create a package under that category.
    const packageName = `E2E Package ${stamp}`;
    await page.goto("/admin/packages");
    await page.getByRole("button", { name: "New package" }).click();
    await page.getByLabel("Category").click();
    await page.getByRole("option", { name: categoryName }).click();
    await page.getByLabel("Name (English)").fill(packageName);
    await page.getByLabel("Name (Spanish)").fill(`Paquete E2E ${stamp}`);
    await page.getByLabel("Type").fill("standard");
    await page.getByLabel("Price (MXN)").fill("12000");
    await page.getByRole("button", { name: "Create package" }).click();

    await expect(page.getByText(packageName)).toBeVisible();
  });
});
