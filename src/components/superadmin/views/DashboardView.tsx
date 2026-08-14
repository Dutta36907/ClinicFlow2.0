// Platform-wide dashboard for super admins.
// Single server round-trip via getSuperAdminDashboard — the aggregator fans
// out 20+ head-count queries in parallel on the server in place of the
// browser firing each one over the network.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSuperAdminDashboard } from "@/lib/dashboard.functions";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { useSuperAdminView } from "@/stores/superadminViewStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Stethoscope,
  CalendarDays,
  Users,
  CheckCircle2,
  PauseCircle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Clock,
  CalendarCheck2,
} from "lucide-react";
import { EmptyMsg, Kpi, ListSkeleton, MiniStat } from "./shared";

export function DashboardView() {
  const setView = useSuperAdminView((s) => s.setView);

  const fetchDashboard = useServerFn(getSuperAdminDashboard);
  const dash = useQuery({
    queryKey: ["sa-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const loading = dash.isLoading;
  const d = dash.data;
  const totalClinics = d?.clinics.total ?? 0;
  const activeClinics = d?.clinics.active ?? 0;
  const inactiveClinics = d?.clinics.inactive ?? 0;
  const totalDoctors = d?.doctors.total ?? 0;
  const activeDoctors = d?.doctors.active ?? 0;
  const totalAppts = d?.appointments.total ?? 0;
  const pendingAppts = d?.appointments.pending ?? 0;
  const totalUsers = d?.users.total ?? 0;
  const newClinicsWeek = d?.clinics.newThisWeek ?? 0;
  const newApptsWeek = d?.appointments.newThisWeek ?? 0;
  const recentClinics = d?.recentClinicsList ?? [];
  const recentAppts = d?.recentApptsList ?? [];

  return (
    <SuperAdminLayout title="Dashboard" subtitle="Platform-wide overview">
      {/* Hero band */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-[color:var(--chart-1)]/10 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-[color:var(--chart-1)]/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-3 bg-background/70 backdrop-blur">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back, Admin
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Here's a snapshot of every clinic, doctor, and appointment moving through the platform
              today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView("clinics")}
              className="gap-1.5 bg-background/70 backdrop-blur"
            >
              <Building2 className="size-4" /> Manage clinics
            </Button>
            <Button size="sm" onClick={() => setView("appointments")} className="gap-1.5">
              <CalendarDays className="size-4" /> View appointments
            </Button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Clinics"
          value={totalClinics}
          icon={Building2}
          hint={`${activeClinics} active · ${inactiveClinics} inactive`}
          delta={newClinicsWeek > 0 ? `+${newClinicsWeek} this week` : undefined}
          loading={loading}
          tone="primary"
        />
        <Kpi
          label="Doctors"
          value={totalDoctors}
          icon={Stethoscope}
          hint={`${activeDoctors} active`}
          loading={loading}
          tone="chart-1"
        />
        <Kpi
          label="Appointments"
          value={totalAppts}
          icon={CalendarDays}
          hint={`${pendingAppts} pending`}
          delta={newApptsWeek > 0 ? `+${newApptsWeek} this week` : undefined}
          loading={loading}
          tone="chart-2"
        />
        <Kpi
          label="Users"
          value={totalUsers}
          icon={Users}
          hint="Registered accounts"
          loading={loading}
          tone="chart-4"
        />
      </div>

      {/* Mini stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Active clinics" value={activeClinics} icon={CheckCircle2} tone="chart-2" />
        <MiniStat label="Inactive" value={inactiveClinics} icon={PauseCircle} tone="muted" />
        <MiniStat label="Pending appts" value={pendingAppts} icon={Activity} tone="chart-3" />
        <MiniStat
          label="New this week"
          value={newClinicsWeek + newApptsWeek}
          icon={TrendingUp}
          tone="primary"
        />
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/70 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 bg-muted/30">
            <div>
              <CardTitle className="text-base">Recent clinics</CardTitle>
              <CardDescription>Newly onboarded tenants</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setView("clinics")}>
              View all <ArrowUpRight className="size-3.5" />
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : recentClinics.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentClinics.map((cl) => (
                  <li
                    key={cl.id}
                    className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{cl.name}</p>
                        <p className="truncate text-xs text-muted-foreground">/{cl.slug}</p>
                      </div>
                    </div>
                    <Badge
                      variant={cl.is_active ? "default" : "secondary"}
                      className={
                        cl.is_active
                          ? "shrink-0 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                          : "shrink-0"
                      }
                    >
                      {cl.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyMsg text="No clinics yet" />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 bg-muted/30">
            <div>
              <CardTitle className="text-base">Upcoming activity</CardTitle>
              <CardDescription>Latest appointments</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setView("appointments")}
            >
              View <ArrowUpRight className="size-3.5" />
            </Button>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {loading ? (
              <ListSkeleton rows={6} />
            ) : recentAppts.length > 0 ? (
              <ScrollArea className="h-[340px]">
                <ul className="divide-y divide-border">
                  {recentAppts.map((a) => {
                    const tone =
                      a.status === "confirmed"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : a.status === "pending"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : a.status === "cancelled"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-muted text-muted-foreground border-border";
                    const dot =
                      a.status === "confirmed"
                        ? "bg-emerald-500"
                        : a.status === "pending"
                          ? "bg-amber-500"
                          : a.status === "cancelled"
                            ? "bg-destructive"
                            : "bg-muted-foreground/50";
                    return (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                          <CalendarCheck2 className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{a.patient_name}</p>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}
                            >
                              <span className={`size-1.5 rounded-full ${dot}`} />
                              {a.status}
                            </span>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(a.scheduled_at).toLocaleString()}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : (
              <EmptyMsg text="No appointments yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
