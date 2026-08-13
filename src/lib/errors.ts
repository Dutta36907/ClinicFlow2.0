/**
 * AppError — a thrown error that carries a SAFE, user-facing message.
 *
 * Server functions and route handlers should wrap any caught provider error
 * (Postgres, Supabase, external HTTP) in an `AppError`. The original error
 * is preserved as `cause` for server-side logs, but only `userMessage` is
 * meant to ever reach the browser. Toast handlers can read `userMessage`
 * directly without leaking internals.
 */
export class AppError extends Error {
  readonly userMessage: string;
  readonly code?: string;

  constructor(userMessage: string, opts: { code?: string; cause?: unknown } = {}) {
    super(userMessage);
    this.name = "AppError";
    this.userMessage = userMessage;
    if (opts.code) this.code = opts.code;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** Best-effort safe message for a toast — never leaks raw provider text. */
export function userFacingMessage(e: unknown, fallback = "Something went wrong"): string {
  if (isAppError(e)) return e.userMessage;
  return fallback;
}

/** Mask a phone number for audit logging — keep only the last 4 digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}
