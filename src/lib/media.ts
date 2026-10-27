// The API returns image URLs either as an absolute S3 URL (S3 mode) or as a path on the
// API origin, e.g. `/api/public/catalog/images/...` (local-disk mode). The admin app runs
// on a different origin than the API, so a path must be resolved against the API origin or
// the browser requests it from the admin origin and gets a 404 (broken image).
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(
  /\/api\/?$/,
  "",
);

/** Resolves an API image URL for use in an <img src>. Absolute URLs pass through unchanged. */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}
