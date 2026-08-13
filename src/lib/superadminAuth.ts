import { supabase } from "@/integrations/supabase/client";
import { clearSuperAdminCache } from "@/components/SuperAdminLayout";
import { applyRememberMe } from "@/lib/rememberMe";

const PROJECT_REF = "xvcjkvjopmpnxuddlikb";
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;
const FLAG_KEY = `${AUTH_KEY}-session-only`;

/**
 * Dedicated super-admin sign-out.
 *
 * Uses `scope: "local"` so signing out on this device does not revoke the
 * refresh token used by the same account on other devices/tabs. (Previously
 * `"global"` caused other active sessions to silently log out on their next
 * token refresh.)
 */
export async function signOutSuperAdmin() {
  clearSuperAdminCache();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("[auth] local signOut failed; clearing local state anyway", err);
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      /* storage unavailable; ignore */
    }
    applyRememberMe(true);
    window.location.replace("/superadmin/login");
  }
}
