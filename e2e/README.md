# End-to-end tests (Playwright)

These specs drive the real admin UI against a **locally running, seeded backend**. They
do not start anything for you — Next's `dev` and `build` share `.next`, so Playwright must
not trigger a build while the dev server is up.

## One-time

```bash
npx playwright install chromium
```

## Run

1. Backend up + seeded (from the `constDocManagment` repo):
   ```bash
   docker compose up -d
   docker compose exec api npm run db:seed
   ```
2. This app in dev (separate terminal):
   ```bash
   npm run dev          # http://localhost:3000
   ```
3. The tests:
   ```bash
   npm run e2e                      # all specs
   npm run e2e -- catalogue         # one file
   ```

Override targets with `PLAYWRIGHT_BASE_URL` (app) and `PLAYWRIGHT_API_URL` (API).

## What runs

- `catalogue.spec.ts` — create a category, then a package under it.
- `documents.spec.ts` — reject a document with a note; upload the official file. Each test
  provisions its own document through the API (`support/helpers.ts`) and then drives the
  UI, so the specs are self-contained against a freshly seeded database.
- `screenshots.spec.ts` — captures every catalogue/document screen at 375px and 1280px
  into `e2e/screenshots/` for the PR description.

The document actions are performed by an **admin** in the `/admin/documents` console (the
review console lives there because only admin endpoints expose customer and requirement
names — see the decision in the plan).
