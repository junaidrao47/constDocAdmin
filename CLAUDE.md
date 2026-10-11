# admin-frontend (ConstDoc admin + staff portal)

- Next.js **15.5.7** App Router. Don't upgrade without approval. Dev port 3000; API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`).
- Checks: `npx tsc --noEmit && npm run lint && npm test && npm run build`.
- Route groups: `(admin)` (role admin) and `(staff)` (agent/manager), guarded in each `layout.tsx`. The API enforces roles; the guards are UX only.
- API calls go through `apiRequest()` in `src/lib/api.ts` (Bearer token, unwraps `{ data }`, refresh on 401).
- Currency is MXN. Never hardcode another currency.
- Tests: layouts render nav twice (mobile nav + desktop sidebar), so use `getAllByRole` for nav links.
- Format: `npm run format` / `npm run format:check` (Prettier 3.9.9). Run `format` twice if `format:check` still complains.
- `tsconfig.json` extends `../constDocManagment/tsconfig.base.json`, so the backend repo must sit next to this one.
- Next 15 `next dev` and `next build` share `.next`. Running a build while the dev server is up fails with random missing-module errors. Stop dev first, or build in a copy on the same drive (webpack can't resolve across drives).
- If a build dies with "JavaScript heap out of memory", the machine is short on RAM: retry with `NODE_OPTIONS=--max-old-space-size=3072`.

## UI conventions
- shadcn/ui (CLI `shadcn@4.21.0`, style new-york, base radix) lives in `src/components/ui/`. Add more with `npx shadcn@4.21.0 add <name>`, then change any `from "cn"` import to `from "@/lib/utils"`, `npm uninstall cn`, and pin deps exactly. We do NOT use the `cn` npm package.
- No `tw-animate-css`: dialog/sheet animation classes are no-ops (intentional, not approved yet).
- Colours come only from tokens in `src/app/globals.css` (bg-primary, text-muted-foreground, bg-success/10, ...). Never hex or palette classes (amber-700, slate-500) in pages. The same tokens live in customer-portal; change both.
- Money: `formatMoney(value, currency?)` from `src/lib/format.ts` (MXN, es-MX). Dates: `formatDate()` from the same file.
- Statuses: `<StatusBadge status=... />` from `src/components/status-badge.tsx` covers document, quotation and invoice statuses.
- Metadata: root `title`/`description` live in `src/app/layout.tsx` (`title` uses `{ default: "ConstDoc Admin", template: "%s · ConstDoc Admin" }`). `"use client"` pages can't export metadata.
