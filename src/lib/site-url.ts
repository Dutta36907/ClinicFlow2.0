/**
 * Canonical public origin, no trailing slash. Used for canonical links,
 * OG/Twitter URLs, JSON-LD, and the sitemap. Set `VITE_APP_URL` per
 * environment (it mirrors the server-only `APP_URL` used by email links —
 * this one is build-time inlined so route `head()` functions can read it
 * isomorphically).
 */
export const SITE_URL = (
  import.meta.env.VITE_APP_URL ?? "https://your-domain.example"
).replace(/\/$/, "");
