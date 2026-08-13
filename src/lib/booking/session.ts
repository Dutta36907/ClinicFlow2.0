/**
 * Booking session id — a per-tab UUID stored in sessionStorage so on-screen
 * OTPs can be bound to the browser tab that requested them. Cleared after
 * successful booking completion or on "Get a new code".
 *
 * Never stored in localStorage (would persist across tabs/sessions). Never
 * sent to any third party. The server hashes it before any DB operation;
 * the raw value never leaves this browser tab + the request body.
 */
const SESSION_KEY = "cf_booking_session";

export function getOrCreateBookingSessionId(): string {
  if (typeof window === "undefined") {
    // SSR fallback — should never be called on the server, but return a
    // throwaway UUID instead of throwing so dev builds don't crash.
    return crypto.randomUUID();
  }
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearBookingSessionId(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}
