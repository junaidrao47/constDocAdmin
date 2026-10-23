import { type APIRequestContext, type Page, expect } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api";

export const ADMIN = { email: "admin@test.com", password: "AdminPassword123!" };

/** Logs in through the admin login screen and lands on the control workspace. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.locator("input[type=email]").fill(ADMIN.email);
  await page.locator("input[type=password]").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 20_000 });
}

async function token(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/auth/login`, { data: ADMIN });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.accessToken as string;
}

export type ProvisionTarget = "under_review" | "submitted_to_government";

/**
 * Creates a document (as admin, on a seeded customer's behalf) and advances it to the
 * target status through the real status endpoint — no file bytes needed, since the
 * document row exists the moment an upload target is issued. Returns its id.
 */
export async function provisionDocument(
  request: APIRequestContext,
  target: ProvisionTarget,
): Promise<string> {
  const accessToken = await token(request);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const customers = await request.get(`${API}/admin/users?role=customer&pageSize=1`, { headers });
  const customerId = (await customers.json()).data.items[0].id as string;

  const created = await request.post(`${API}/documents/upload-url`, {
    headers,
    data: { fileName: "e2e-fixture.pdf", contentType: "application/pdf", customerId },
  });
  expect(created.ok()).toBeTruthy();
  const documentId = (await created.json()).data.document.id as string;

  const path =
    target === "under_review"
      ? ["under_review"]
      : ["under_review", "approved", "submitted_to_government"];

  let from = "pending";
  for (const to of path) {
    const res = await request.patch(`${API}/documents/${documentId}/status`, {
      headers,
      data: { fromStatus: from, toStatus: to },
    });
    expect(res.ok(), `transition ${from} -> ${to}`).toBeTruthy();
    from = to;
  }
  return documentId;
}
