// "Remember me" handling for Supabase auth.
//
// Supabase persists the session in localStorage by default, which survives
// browser restarts. When the user unchecks "Remember me" we instead want the
// session to live only for the current browser session — i.e. cleared when
// the browser process exits.
//
// Strategy: when remember-me is off, after sign-in we move the auth token
// from localStorage into sessionStorage. On the next page load we rehydrate
// it back into localStorage *before* the Supabase client initializes, so the
// client picks it up normally. sessionStorage is cleared by the browser when
// the last tab for the origin closes, giving us session-only persistence.

const PROJECT_REF = "xvcjkvjopmpnxuddlikb";
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;
const FLAG_KEY = `${AUTH_KEY}-session-only`;

export function rehydrateSessionAuth() {
  if (typeof window === "undefined") return;
  try {
    const stashed = sessionStorage.getItem(AUTH_KEY);
    if (stashed && !localStorage.getItem(AUTH_KEY)) {
      localStorage.setItem(AUTH_KEY, stashed);
      sessionStorage.setItem(FLAG_KEY, "1");
    }
  } catch {
    /* storage unavailable; ignore */
  }
}

export function applyRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (remember) {
      // Persistent across restarts — leave token in localStorage.
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(FLAG_KEY);
      return;
    }
    const token = localStorage.getItem(AUTH_KEY);
    if (token) {
      sessionStorage.setItem(AUTH_KEY, token);
      sessionStorage.setItem(FLAG_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

// Keep sessionStorage stash in sync with token refreshes while the tab is
// open, so a refreshed token isn't lost on the next page load.
export function startSessionOnlySync() {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", () => {
    if (sessionStorage.getItem(FLAG_KEY) !== "1") return;
    const latest = localStorage.getItem(AUTH_KEY);
    if (latest) sessionStorage.setItem(AUTH_KEY, latest);
  });
  // Mirror in-tab updates too (the `storage` event only fires cross-tab).
  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    origSetItem.call(this, key, value);
    if (
      this === window.localStorage &&
      key === AUTH_KEY &&
      sessionStorage.getItem(FLAG_KEY) === "1"
    ) {
      try {
        sessionStorage.setItem(AUTH_KEY, value);
      } catch {
        /* ignore */
      }
    }
  };
}
