// Thin shell route for the super-admin app.
import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type * as React from "react";
import { ensureSuperAdmin } from "@/components/SuperAdminLayout";
import { useSuperAdminView, type SuperAdminView } from "@/stores/superadminViewStore";
import { useSuperAdminPermissions, canViewSection } from "@/hooks/useSuperAdminPermissions";
import { toast } from "sonner";
import { DashboardView } from "@/components/superadmin/views/DashboardView";
import { ClinicsView } from "@/components/superadmin/views/ClinicsView";
import { DoctorsView } from "@/components/superadmin/views/DoctorsView";
import { AppointmentsView } from "@/components/superadmin/views/AppointmentsView";
import { ClinicSettingsView } from "@/components/superadmin/views/ClinicSettingsView";
import { CustomersView } from "@/components/superadmin/views/CustomersView";
import { SystemUsersView } from "@/components/superadmin/views/SystemUsersView";
import { UserRolesView } from "@/components/superadmin/views/UserRolesView";
import { ProfileView } from "@/components/superadmin/views/ProfileView";
import { AuditView } from "@/components/superadmin/views/AuditView";
import { MonitoringView } from "@/components/superadmin/views/MonitoringView";
import { SettingsView } from "@/components/superadmin/views/SettingsView";
import { EnquiriesView } from "@/components/superadmin/views/EnquiriesView";
import { SubscriptionsView } from "@/components/superadmin/views/SubscriptionsView";

type SearchShape = { page: number; size: 10 | 25 | 50 | 100 };

const ALLOWED_SIZES = [10, 25, 50, 100] as const;

export const Route = createFileRoute("/superadmin/")({
  validateSearch: (raw: Record<string, unknown>): SearchShape => {
    const pageNum = Number(raw.page);
    const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
    const sizeNum = Number(raw.size);
    const size = (ALLOWED_SIZES as readonly number[]).includes(sizeNum)
      ? (sizeNum as SearchShape["size"])
      : 25;
    return { page, size };
  },
  beforeLoad: ensureSuperAdmin,
  head: () => ({ meta: [{ title: "Super Admin" }] }),
  component: SuperAdminShell,
});

function SuperAdminShell() {
  const view = useSuperAdminView((s) => s.view);
  const setView = useSuperAdminView((s) => s.setView);
  const { data: perms } = useSuperAdminPermissions();
  const navigate = useNavigate({ from: "/superadmin/" });
  const prevView = useRef<SuperAdminView>(view);

  useEffect(() => {
    if (!perms) return;
    if (!canViewSection(perms, view)) {
      toast.error("You don't have access to that section");
      setView("dashboard");
    }
  }, [perms, view, setView]);

  // Reset page to 1 whenever the active view changes.
  useEffect(() => {
    if (prevView.current !== view) {
      prevView.current = view;
      navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, page: 1 }),
        replace: true,
      });
    }
  }, [view, navigate]);

  const views: Record<SuperAdminView, React.ReactElement> = {
    dashboard: <DashboardView />,
    clinics: <ClinicsView />,
    doctors: <DoctorsView />,
    appointments: <AppointmentsView />,
    clinicSettings: <ClinicSettingsView />,
    enquiries: <EnquiriesView />,
    customers: <CustomersView />,
    subscriptions: <SubscriptionsView />,
    systemUsers: <SystemUsersView />,
    userRoles: <UserRolesView />,
    profile: <ProfileView />,
    audit: <AuditView />,
    monitoring: <MonitoringView />,
    settings: <SettingsView />,
  };
  return views[view];
}
