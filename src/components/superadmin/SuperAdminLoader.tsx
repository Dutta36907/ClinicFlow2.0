import { Stethoscope, ShieldCheck } from "lucide-react";
import { AppLoadingSplash } from "@/components/common/AppLoadingSplash";

/**
 * Branded full-screen loader for the super admin console.
 * Delegates to the shared AppLoadingSplash so every authenticated surface
 * uses the same visual language.
 */
export function SuperAdminLoader({ label = "Loading ClinicFlow Admin…" }: { label?: string }) {
  return (
    <AppLoadingSplash
      title="Super Admin"
      message={label}
      icon={Stethoscope}
      badgeIcon={ShieldCheck}
    />
  );
}
