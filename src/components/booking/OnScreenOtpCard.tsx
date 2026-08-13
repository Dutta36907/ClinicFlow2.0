/**
 * OnScreenOtpCard — displays a server-generated 6-digit code that the
 * patient reads and types into the OTP input. The card auto-destructs
 * after 30 seconds: the digits are overwritten in React state (not just
 * hidden via CSS) so the original code value has no surviving reference
 * in the DOM tree.
 *
 * SECURITY:
 *   - No copy-to-clipboard button (intentional friction; avoids leaving the
 *     code in the system clipboard beyond expiry).
 *   - No useRef / closure retention of the original code beyond expiry.
 *   - The card is not user-dismissable while the code is still valid.
 */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const DURATION_S = 30;
const WARN_AT_S = 10;

export function OnScreenOtpCard({
  code,
  onExpire,
  onDismiss,
}: {
  code: string;
  onExpire: () => void;
  onDismiss?: () => void;
}) {
  const [displayCode, setDisplayCode] = useState<string>(code);
  const [remaining, setRemaining] = useState<number>(DURATION_S);
  const [expired, setExpired] = useState(false);

  // Reset state every time a new code is mounted (Card receives a fresh
  // `code` prop on regenerate).
  useEffect(() => {
    setDisplayCode(code);
    setRemaining(DURATION_S);
    setExpired(false);
  }, [code]);

  useEffect(() => {
    if (expired) return;
    if (remaining <= 0) {
      // Overwrite the displayed code in React state. After this setState,
      // the original code string has no reference in active state and is
      // unreachable from the rendered DOM.
      setDisplayCode("------");
      setExpired(true);
      const t = setTimeout(() => onExpire(), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, expired, onExpire]);

  const warn = remaining <= WARN_AT_S && !expired;
  const progressPct = expired ? 0 : Math.max(0, (remaining / DURATION_S) * 100);

  return (
    <div
      role="region"
      aria-label="Verification code"
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm transition-colors",
        warn ? "border-amber-500/60 animate-pulse-soft" : "border-border",
        expired && "border-muted-foreground/30 opacity-90",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Lock className={cn("size-4", warn ? "text-amber-600" : "text-primary")} />
        <span>Your verification code</span>
      </div>

      <div
        className="mt-4 flex justify-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {Array.from(displayCode).map((digit, i) => (
          <div
            key={i}
            className={cn(
              "flex h-14 w-12 items-center justify-center rounded-lg border font-mono text-3xl font-semibold tabular-nums",
              expired
                ? "border-muted-foreground/30 text-muted-foreground"
                : warn
                  ? "border-amber-500/70 text-amber-700"
                  : "border-primary/30 text-primary",
            )}
          >
            {digit}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={DURATION_S}
          aria-valuenow={remaining}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-1000 ease-linear",
              expired
                ? "bg-muted-foreground/40"
                : warn
                  ? "bg-amber-500"
                  : "bg-primary",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            expired ? "text-muted-foreground" : warn ? "text-amber-700" : "text-muted-foreground",
          )}
        >
          {expired ? "Code expired" : `${remaining}s remaining`}
        </p>
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          Type this code in the field below. It expires in {DURATION_S} seconds
          and works only in this browser tab.
        </p>
        <p>Do not share this code with anyone.</p>
      </div>

      {expired && onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Get a new code
        </button>
      ) : null}
    </div>
  );
}
