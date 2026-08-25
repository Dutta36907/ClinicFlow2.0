// Per-user menu permissions for the super-admin shell.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SuperAdminView } from "@/stores/superadminViewStore";

export type PermissionKey =
  | "can_dashboard"
  | "can_clinics"
  | "can_doctors"
  | "can_appointments"
  | "can_clinic_settings"
  | "can_enquiries"
  | "can_customers"
  | "can_subscriptions"
  | "can_users"
  | "can_user_roles"
  | "can_audit"
  | "can_monitoring";

export const VIEW_PERMISSION: Record<SuperAdminView, PermissionKey | null> = {
  dashboard: "can_dashboard",
  clinics: "can_clinics",
  doctors: "can_doctors",
  appointments: "can_appointments",
  clinicSettings: "can_clinic_settings",
  enquiries: "can_enquiries",
  customers: "can_customers",
  subscriptions: "can_subscriptions",
  systemUsers: "can_users",
  userRoles: "can_user_roles",
  audit: "can_audit",
  monitoring: "can_monitoring",
  settings: null,
  profile: null,
};

export type Permissions = Record<PermissionKey, boolean>;

const ALL_TRUE: Permissions = {
  can_dashboard: true,
  can_clinics: true,
  can_doctors: true,
  can_appointments: true,
  can_clinic_settings: true,
  can_enquiries: true,
  can_customers: true,
  can_subscriptions: true,
  can_users: true,
  can_user_roles: true,
  can_audit: true,
  can_monitoring: true,
};

export function useSuperAdminPermissions() {
  return useQuery({
    queryKey: ["sa-permissions"],
    queryFn: async (): Promise<Permissions> => {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user.id;
      if (!uid) return ALL_TRUE;
      const { data } = await supabase
        .from("super_admin_permissions")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data) return ALL_TRUE;
      const d = data as Record<string, unknown>;
      return {
        can_dashboard: !!d.can_dashboard,
        can_clinics: !!d.can_clinics,
        can_doctors: !!d.can_doctors,
        can_appointments: !!d.can_appointments,
        can_clinic_settings: !!d.can_clinic_settings,
        can_enquiries: !!d.can_enquiries,
        can_customers: !!d.can_customers,
        can_subscriptions: !!d.can_subscriptions,
        can_users: !!d.can_users,
        can_user_roles: !!d.can_user_roles,
        can_audit: !!d.can_audit,
        can_monitoring: !!d.can_monitoring,
      };
    },
    staleTime: 60_000,
  });
}

export function canViewSection(perms: Permissions | undefined, view: SuperAdminView): boolean {
  const key = VIEW_PERMISSION[view];
  if (!key) return true;
  if (!perms) return true;
  return perms[key];
}
