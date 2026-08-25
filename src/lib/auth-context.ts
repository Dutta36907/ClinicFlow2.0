import { supabase } from "@/integrations/supabase/client";

export interface AuthContext {
  isSuper: boolean;
  isDisabled: boolean;
  managedClinicIds: string[];
  userClinicIds: string[];
}

const cache = new Map<string, Promise<AuthContext>>();

/** Single, per-uid memoized wrapper around the get_user_auth_context RPC. */
export function getAuthContext(uid: string): Promise<AuthContext> {
  let pending = cache.get(uid);
  if (!pending) {
    pending = Promise.resolve(supabase.rpc("get_user_auth_context", { _uid: uid })).then(
      ({ data, error }) => {
        if (error) throw error;
        const row = data?.[0];
        return {
          isSuper: !!row?.is_super,
          isDisabled: !!row?.is_disabled,
          managedClinicIds: row?.clinic_ids ?? [],
          userClinicIds: row?.clinic_user_ids ?? [],
        };
      },
    );
    cache.set(uid, pending);
    pending.catch(() => cache.delete(uid));
  }
  return pending;
}

export function clearAuthContextCache() {
  cache.clear();
}
