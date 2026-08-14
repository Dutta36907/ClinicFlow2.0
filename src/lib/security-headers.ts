/**
 * Security headers applied to every response from src/server.ts.
 *
 * - CSP is only attached to HTML responses (no value on JSON/asset responses).
 * - Other headers (HSTS, nosniff, XFO, Referrer-Policy, Permissions-Policy, COOP)
 *   are applied to every response.
 */

const SUPABASE_ORIGIN = "https://ndmlkadsvmbskaddhzvg.supabase.co";
const SUPABASE_WS = "wss://ndmlkadsvmbskaddhzvg.supabase.co";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const BASE_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  const contentType = headers.get("content-type") ?? "";
  if (
    contentType.toLowerCase().startsWith("text/html") &&
    !headers.has("Content-Security-Policy")
  ) {
    headers.set("Content-Security-Policy", CSP);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
