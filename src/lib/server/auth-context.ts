/**
 * Shared server-side role/access checks — single source of truth for the
 * assertSuperAdmin/assertClinicAccess pattern previously copy-pasted across
 * dashboard.functions.ts, clinicmanager.functions.ts, superadmin.functions.ts,
 * and media.functions.ts.
 */

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

export interface AuthContext {
  isSuper: boolean;
  isDisabled: boolean;
  managedClinicIds: string[];
  userClinicIds: string[];
}

export async function getAuthContext(userId: string): Promise<AuthContext> {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return {
    isSuper: !!row?.is_super,
    isDisabled: !!row?.is_disabled,
    managedClinicIds: row?.clinic_ids ?? [],
    userClinicIds: row?.clinic_user_ids ?? [],
  };
}

export async function assertSuperAdmin(userId: string) {
  const ctx = await getAuthContext(userId);
  if (!ctx.isSuper) throw new Error("Not authorized");
  if (ctx.isDisabled) throw new Error("Your account is disabled");
}

export async function assertClinicAccess(userId: string, clinicId: string) {
  const ctx = await getAuthContext(userId);
  if (ctx.isSuper) {
    if (ctx.isDisabled) throw new Error("Your account is disabled");
    return;
  }
  if (!ctx.managedClinicIds.includes(clinicId)) throw new Error("Not authorized");
}
