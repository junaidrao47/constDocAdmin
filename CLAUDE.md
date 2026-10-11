# admin-frontend (ConstDoc admin + staff portal)

- Next.js **15.5.7** App Router. Don't upgrade without approval. Dev port 3000; API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`).
- Checks: `npx tsc --noEmit && npm run lint && npm test && npm run build`.
- Route groups: `(admin)` (role admin) and `(staff)` (agent/manager), guarded in each `layout.tsx`. The API enforces roles; the guards are UX only.
- API calls go through `apiRequest()` in `src/lib/api.ts` (Bearer token, unwraps `{ data }`, refresh on 401).
- Currency is MXN. Never hardcode another currency.
- Tests: layouts render nav twice (mobile nav + desktop sidebar), so use `getAllByRole` for nav links.
