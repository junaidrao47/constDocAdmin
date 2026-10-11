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
