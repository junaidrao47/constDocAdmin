import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./support/helpers";

/**
 * Captures the catalogue + document screens at phone (375px) and desktop (1280px) for
 * the PR description. Output lands in e2e/screenshots/.
 */
const PAGES = [
  { path: "/admin/categories", name: "categories" },
  { path: "/admin/services", name: "services" },
  { path: "/admin/packages", name: "packages" },
  { path: "/admin/documents", name: "documents" },
];

const SIZES = [
  { label: "375", width: 375, height: 760 },
  { label: "1280", width: 1280, height: 900 },
];

test("capture responsive screenshots", async ({ page }) => {
  await loginAsAdmin(page);
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const target of PAGES) {
      await page.goto(target.path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await page.waitForTimeout(600); // let the first data load settle
      await page.screenshot({ path: `e2e/screenshots/${target.name}-${size.label}.png`, fullPage: true });
    }
  }
});
