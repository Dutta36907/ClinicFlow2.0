// Server-only rate limiting for public booking endpoints.
// Backed by Postgres (`public.consume_rate_limit`) so it survives across
// serverless worker invocations and works in a multi-replica environment.
//
// Usage:
//   await assertRateLimit(`otp:request:${phone}`, { capacity: 5, refillSeconds: 600 });
//
// Throws a user-safe Error when the bucket is empty so the caller's response
// surface stays clean (TanStack server-fn errors render in the UI as-is).
// Server-only: imports supabaseAdmin and request headers helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

export interface RateLimitOptions {
  /** Max tokens in the bucket (= max calls per window). */
  capacity: number;
  /** Window length in seconds. */
  refillSeconds: number;
  /** Human-readable label used in the error message. */
  label?: string;
}

/**
 * Best-effort client IP for keying public buckets.
 *
 * Priority order matches a Cloudflare-fronted deployment:
 *   1. `cf-connecting-ip` — set by Cloudflare to the real client IP,
 *      cannot be spoofed (CF overwrites incoming headers).
 *   2. `x-real-ip` — set by trusted reverse proxies.
 *   3. First entry of `x-forwarded-for` — spoofable, used last as a
 *      best-effort fallback for non-CF deployments.
 */
export function getClientIp(): string {
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf.trim();
    const real = getRequestHeader("x-real-ip");
    if (real) return real.trim();
    const xf = getRequestHeader("x-forwarded-for");
    if (xf) return xf.split(",")[0]!.trim();
  } catch {
    /* not in request context */
  }
  return "unknown";
}

/**
 * Atomically consume one token. Throws if the bucket is empty.
 * The check is a single SQL call with row-level locking, so two parallel
 * requests cannot both pass when only one token remains.
 */
export async function assertRateLimit(key: string, opts: RateLimitOptions): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    _key: key,
    _capacity: opts.capacity,
    _refill_seconds: opts.refillSeconds,
  });
  if (error) {
    // Don't fail the request on infra errors — log and let it through.
    console.error("[rate-limit] rpc failed", { key, error: error.message });
    return;
  }
  if (data === false) {
    throw new Error(
      opts.label
        ? `Too many ${opts.label} requests. Please wait a moment and try again.`
        : "Too many requests. Please wait a moment and try again.",
    );
  }
}
