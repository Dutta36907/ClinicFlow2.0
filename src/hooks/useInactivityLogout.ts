import { useCallback, useEffect, useRef, useState } from "react";

// Total time with no activity before auto sign-out.
export const IDLE_MS = 20 * 1000; // TEMP-TEST-VALUE: real value is 15 * 60 * 1000
// How long before IDLE_MS the warning dialog appears (with a live countdown).
export const WARNING_MS = 10 * 1000; // TEMP-TEST-VALUE: real value is 60 * 1000

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
] as const;
const LAST_ACTIVITY_KEY = "cf:last-activity";
// Don't reset timers on every single mousemove — only re-arm this often.
const THROTTLE_MS = 2000;

interface UseInactivityLogoutOptions {
  /** Timers/listeners are only attached while true (e.g. once a session exists). */
  enabled: boolean;
  /** Called once the full idle window elapses without the user staying active. */
  onTimeout: () => void;
}

export function useInactivityLogout({ enabled, onTimeout }: UseInactivityLogoutOptions) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_MS / 1000));

  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastResetAt = useRef(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearTimers = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearInterval(countdownInterval.current);
  }, []);

  const arm = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    setSecondsLeft(Math.ceil(WARNING_MS / 1000));

    idleTimer.current = setTimeout(() => {
      setWarningOpen(true);
      const deadline = Date.now() + WARNING_MS;
      countdownInterval.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearTimers();
          onTimeoutRef.current();
        }
      }, 1000);
    }, IDLE_MS - WARNING_MS);
  }, [clearTimers]);

  const stayActive = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch {
      /* storage unavailable; ignore */
    }
    arm();
  }, [arm]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      clearTimers();
      setWarningOpen(false);
      return;
    }

    arm();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastResetAt.current < THROTTLE_MS) return;
      lastResetAt.current = now;
      stayActive();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) arm();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    window.addEventListener("storage", onStorage);

    return () => {
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { warningOpen, secondsLeft, stayActive };
}
