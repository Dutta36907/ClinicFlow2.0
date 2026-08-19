import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { getManagerDashboard } from "@/lib/clinicmanager.functions";
import { useClinicAppointments } from "@/components/clinicmanager/hooks/useClinicAppointments";
import { ManagerSidebar, type ManagerSection } from "@/components/clinicmanager/ManagerSidebar";
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
import { ClinicInactive } from "@/components/landing/ClinicInactive";
import { ClinicExpired } from "@/components/landing/ClinicExpired";
import { ClinicManagerLoginForm } from "@/components/clinicmanager/ClinicManagerLoginForm";
import { ClinicManagerSplash } from "@/components/clinicmanager/ClinicManagerSplash";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";

export const Route = createFileRoute("/$slug_/clinicmanager")({
  validateSearch: (search: Record<string, unknown>) => ({
    via: search.via === "superadmin" ? ("superadmin" as const) : undefined,
  }),
  head: ({ params }) => ({
    meta: [{ title: `Clinic Manager — ${params.slug}` }],
  }),
  component: ClinicManagerDashboard,
});

function LoginShell({
  slug,
  title,
  note,
  extra,
}: {
  slug: string;
  title?: string;
  note?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            ClinicFlow
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {title ?? `Clinic manager sign in`}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {note ?? (
              <>
                Sign in to manage{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/{slug}</code>.
              </>
            )}
          </p>
        </div>
        {extra}
        <ClinicManagerLoginForm />
      </div>
    </div>
  );
}

function ClinicManagerDashboard() {
  const { slug } = Route.useParams();
  const { via } = Route.useSearch();
  const viaSuperAdmin = via === "superadmin";
  const fetchDashboard = useServerFn(getManagerDashboard);
  const [section, setSection] = useState<ManagerSection>("dashboard");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    // Use getUser() — it re-validates the token with the Auth server, so a
    // stale localStorage token left by another tab can't fake a session.
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      setHasSession(!!data.user && !error);
      setSessionChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      const signedOut = event === "SIGNED_OUT" || !s;
      if (signedOut) {
        setHasSession(false);
        setSection("dashboard");
        // Drop any cached manager data so nothing renders from stale state.
        queryClient.removeQueries({ queryKey: ["manager-dashboard", slug] });
        queryClient.removeQueries({ queryKey: ["clinic-appointments"] });
        return;
      }
      setHasSession(!!s);
    });

    // Cross-tab logout: if another tab clears the Supabase auth token,
    // immediately drop session state here too.
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("sb-") && e.key.endsWith("-auth-token") && !e.newValue) {
        setHasSession(false);
        setSection("dashboard");
        queryClient.removeQueries({ queryKey: ["manager-dashboard", slug] });
        queryClient.removeQueries({ queryKey: ["clinic-appointments"] });
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [queryClient, slug]);

  const dashQ = useQuery({
    queryKey: ["manager-dashboard", slug],
    queryFn: () => fetchDashboard({ data: { slug } }),
    enabled: hasSession,
    // Don't serve stale dashboard data across an auth boundary.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const clinicId =
    hasSession && dashQ.data && !("unauthorized" in dashQ.data) ? dashQ.data.clinic.id : null;

  const apptsQ = useClinicAppointments(clinicId);
  const apptCount = useMemo(() => {
    const all = apptsQ.data ?? [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return all.filter((a) => new Date(a.scheduled_at) >= start && a.status !== "cancelled").length;
  }, [apptsQ.data]);

  const { warningOpen, secondsLeft, stayActive } = useInactivityLogout({
    enabled: hasSession,
    onTimeout: () => {
      // No page reload happens here (hasSession flips via onAuthStateChange,
      // re-rendering LoginShell in place) — show the toast directly rather
      // than the sessionStorage-flag handoff the other two surfaces need.
      toast.info("You were signed out due to inactivity.");
      void supabase.auth.signOut();
    },
  });

  if (!sessionChecked) {
    return <ClinicManagerSplash message="Verifying access…" />;
  }

  if (!hasSession) {
    return <LoginShell slug={slug} />;
  }

  if (dashQ.isLoading) {
    return <ClinicManagerSplash message="Loading dashboard…" />;
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
      <LoginShell
        slug={slug}
        title="Sign in as clinic manager"
        note={
          <>
            This account doesn&apos;t have manager access to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/{slug}</code>. Sign in
            with a manager account.
          </>
        }
        extra={
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out");
              }}
            >
              Sign out current account
            </Button>
          </div>
        }
      />
    );
  }

  const clinic = dashQ.data.clinic as DashboardClinic;
  const doctors = dashQ.data.doctors as DashboardDoctor[];
  const role = dashQ.data.role;

  // Gate super-admin auto-impersonation: must arrive via the Clinics tab icon.
  if (role === "super_admin" && !viaSuperAdmin) {
    return (
      <LoginShell
        slug={slug}
        title="Sign in as clinic manager"
        note={
          <>
            You&apos;re signed in as a Super Admin. To manage{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/{slug}</code>, open it
            from the Super Admin Clinics tab, or sign in with a manager account below.
          </>
        }
        extra={
          <div className="mb-4 flex justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/superadmin">Go to Super Admin</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                toast.success("Signed out");
              }}
            >
              Sign out
            </Button>
          </div>
        }
      />
    );
  }

  const expired = !!(clinic.expires_at && new Date(clinic.expires_at) < new Date());
  if (expired) {
    return (
      <ClinicExpired
        clinic={{ name: clinic.name, logo_url: clinic.logo_url, slug: clinic.slug }}
        expiresAt={clinic.expires_at}
        note="Your manager dashboard will unlock once the subscription is renewed."
      />
    );
  }
  if (!clinic.is_active) {
    return (
      <ClinicInactive
        clinic={{ name: clinic.name, logo_url: clinic.logo_url, slug: clinic.slug }}
        note="Your dashboard will unlock once a super admin activates this clinic."
      />
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
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
              <span className="hidden text-xs text-muted-foreground sm:inline">/{clinic.slug}</span>
            </div>
            <div className="flex items-center gap-2">
              <MuteToggle />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="size-3.5" />
                {role === "super_admin" ? "Super admin" : "Clinic manager"}
              </span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
            {section === "dashboard" && <DashboardSection clinic={clinic} doctors={doctors} />}
            {section === "appointments" && (
              <AppointmentsSection clinic={clinic} doctors={doctors} />
            )}
            {section === "doctors" && <DoctorsSection clinic={clinic} doctors={doctors} />}
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
      <InactivityWarningDialog
        open={warningOpen}
        secondsLeft={secondsLeft}
        onStayActive={stayActive}
      />
    </SidebarProvider>
  );
}
