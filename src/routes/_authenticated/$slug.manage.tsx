import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UiV2Toggle } from "@/components/ui/ui-v2-toggle";
import { getManagerDashboard } from "@/lib/clinicmanager.functions";
import { useClinicAppointments } from "@/components/clinicmanager/hooks/useClinicAppointments";
import {
  ManagerSidebar,
  type ManagerSection,
} from "@/components/clinicmanager/ManagerSidebar";
import {
  AppointmentsSection,
  DashboardSection,
  DoctorsSection,
  ProfileSection,
  SettingsSection,
  CoverSection,
  StatsSection,
  TreatmentsSection,
  TestimonialsSection,
  GallerySection,
  MediaLibrarySection,
  type DashboardClinic,
  type DashboardDoctor,
} from "@/components/clinicmanager/sections";
import { MuteToggle } from "@/components/clinicmanager/shared/MuteToggle";

export const Route = createFileRoute("/_authenticated/$slug/manage")({
  component: ClinicManage,
});

function ClinicManage() {
  const { slug } = Route.useParams();
  const fetchDashboard = useServerFn(getManagerDashboard);
  const [section, setSection] = useState<ManagerSection>("dashboard");

  const dashQ = useQuery({
    queryKey: ["manager-dashboard", slug],
    queryFn: () => fetchDashboard({ data: { slug } }),
  });

  const clinicId =
    dashQ.data && !("unauthorized" in dashQ.data) ? dashQ.data.clinic.id : null;

  // Single shared appointments source — same data the Dashboard /
  // Appointments / Overview sections read from.
  const apptsQ = useClinicAppointments(clinicId);
  const apptCount = useMemo(() => {
    const all = apptsQ.data ?? [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return all.filter(
      (a) =>
        new Date(a.scheduled_at) >= start && a.status !== "cancelled",
    ).length;
  }, [apptsQ.data]);

  if (dashQ.isLoading) {
    return <div className="p-10 text-muted-foreground">Loading dashboard…</div>;
  }

  if (!dashQ.data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl">Clinic not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No clinic at /{slug}.</p>
      </div>
    );
  }

  if ("unauthorized" in dashQ.data) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have access to manage this clinic.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/$slug" params={{ slug }}>
            Back to booking page
          </Link>
        </Button>
      </div>
    );
  }

  const clinic = dashQ.data.clinic as DashboardClinic;
  const doctors = dashQ.data.doctors as DashboardDoctor[];
  const role = dashQ.data.role;

  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-57px)] w-full">
        <ManagerSidebar
          slug={clinic.slug}
          clinicName={clinic.name}
          logoUrl={clinic.logo_url}
          active={section}
          onSelect={setSection}
          appointmentCount={apptCount}
        />

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium">{clinic.name}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                /{clinic.slug}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <UiV2Toggle />
              <MuteToggle />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="size-3.5" />
                {role === "super_admin" ? "Super admin" : "Clinic manager"}
              </span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
            {section === "dashboard" && (
              <DashboardSection clinic={clinic} doctors={doctors} />
            )}
            {section === "appointments" && (
              <AppointmentsSection clinic={clinic} doctors={doctors} />
            )}
            {section === "doctors" && (
              <DoctorsSection clinic={clinic} doctors={doctors} />
            )}
            {section === "details" && <ProfileSection clinic={clinic} />}
            {section === "cover" && <CoverSection clinic={clinic} />}
            {section === "stats" && <StatsSection clinic={clinic} />}
            {section === "treatments" && <TreatmentsSection clinic={clinic} />}
            {section === "testimonials" && <TestimonialsSection clinic={clinic} />}
            {section === "gallery" && <GallerySection clinic={clinic} />}
            {section === "media" && <MediaLibrarySection clinic={clinic} />}
            {section === "settings" && <SettingsSection clinic={clinic} doctors={doctors} />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
