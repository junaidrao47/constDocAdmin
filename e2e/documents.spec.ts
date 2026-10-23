import path from "node:path";
import { expect, test } from "@playwright/test";
import { loginAsAdmin, provisionDocument } from "./support/helpers";

const FIXTURE_PDF = path.join(__dirname, "fixtures", "sample.pdf");

test.describe("document review", () => {
  test("staff rejects a document with a note", async ({ page, request }) => {
    await provisionDocument(request, "under_review");
    await loginAsAdmin(page);

    await page.goto("/admin/documents");
    await page.getByLabel("Filter by status").click();
    await page.getByRole("option", { name: "under review" }).click();

    await page.getByRole("button", { name: "Review" }).first().click();
    await page.getByRole("button", { name: "Reject" }).click();

    // A note under 5 chars is blocked inline…
    await page.getByLabel("Reason for rejection").fill("no");
    await page.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(page.getByText("A note of at least 5 characters is required")).toBeVisible();

    // …and a real note goes through.
    await page.getByLabel("Reason for rejection").fill("Permit has expired, please resubmit.");
    await page.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(page.getByText("Rejected")).toBeVisible();
  });

  test("staff uploads the official file", async ({ page, request }) => {
    await provisionDocument(request, "submitted_to_government");
    await loginAsAdmin(page);

    await page.goto("/admin/documents");
    await page.getByLabel("Filter by status").click();
    await page.getByRole("option", { name: "submitted to government" }).click();

    await page.getByRole("button", { name: "Review" }).first().click();

    // The official-file panel is the second file input in the drawer.
    await page.locator('input[type=file]').nth(1).setInputFiles(FIXTURE_PDF);

    await expect(page.getByText(/Official file uploaded|Official/).first()).toBeVisible();
    // Once the official file lands the document is approved.
    await expect(page.getByText("Approved").first()).toBeVisible({ timeout: 20_000 });
  });
});
