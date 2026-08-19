// Lets an auto-logout call communicate *why* to whichever login page the
// user lands on next, so it can show a one-time explanatory toast.
const KEY = "cf:logout-reason";

export function markInactivityLogout() {
  try {
    sessionStorage.setItem(KEY, "inactivity");
  } catch {
    /* storage unavailable; ignore */
  }
}

/** Reads and clears the flag — call once on a login page's mount. */
export function consumeInactivityLogoutFlag(): boolean {
  try {
    const flag = sessionStorage.getItem(KEY);
    if (flag) sessionStorage.removeItem(KEY);
    return flag === "inactivity";
  } catch {
    return false;
  }
}
