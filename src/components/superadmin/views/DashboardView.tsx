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
  CalendarCheck2,
  CalendarClock,
  Inbox,
  ScrollText,
} from "lucide-react";
import { EmptyMsg, Kpi, ListSkeleton, MiniStat } from "./shared";

const ACTIVITY_ICON = {
  appointment: {
    icon: CalendarCheck2,
    cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  },
  clinic: { icon: Building2, cls: "bg-primary/10 text-primary" },
  enquiry: { icon: Inbox, cls: "bg-[color:var(--chart-4)]/12 text-[color:var(--chart-4)]" },
  audit: { icon: ScrollText, cls: "bg-[color:var(--chart-3)]/12 text-[color:var(--chart-3)]" },
} as const;

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
  const recentActivity = d?.recentActivity ?? [];
  const topClinics = d?.topBookingClinics ?? [];
  const maxBookings = topClinics[0]?.bookings ?? 0;

  const renewalsCount = d?.renewals.count ?? 0;
  const renewalsWindow = d?.renewals.dueWithinDays ?? 14;
  const nextRenewal = d?.renewals.nextClinic ?? null;
  const unassignedEnquiries = d?.pendingActions.unassignedEnquiriesOver48h ?? 0;
  const unresolvedAlerts = d?.systemHealth.unresolvedAlerts ?? 0;

  const enq = d?.enquiries;
  const funnelSteps = [
    { label: "New", value: enq?.newCount ?? 0 },
    { label: "In progress", value: enq?.inProgressCount ?? 0 },
    { label: "Contacted", value: enq?.contactedCount ?? 0 },
    { label: "Converted", value: enq?.convertedCount ?? 0 },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));
  const funnelTotal = funnelSteps.reduce((sum, s) => sum + s.value, 0);
  const funnelConv =
    funnelTotal > 0 ? Math.round(((enq?.convertedCount ?? 0) / funnelTotal) * 100) : 0;

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

      {/* Main column + rail */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Unified activity feed */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 bg-muted/30">
              <div>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>
                  Bookings, onboarding, enquiries &amp; audit — latest first
                </CardDescription>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {loading ? (
                <ListSkeleton rows={6} />
              ) : recentActivity.length > 0 ? (
                <ScrollArea className="h-[320px]">
                  <ul className="divide-y divide-border">
                    {recentActivity.map((a) => {
                      const { icon: Icon, cls } = ACTIVITY_ICON[a.kind];
                      return (
                        <li
                          key={a.id}
                          className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div
                            className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${cls}`}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.subtitle}</p>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {new Date(a.at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              ) : (
                <EmptyMsg text="No recent activity" />
              )}
            </CardContent>
          </Card>

          {/* Recent clinics */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 bg-muted/30">
              <div>
                <CardTitle className="text-base">Recent clinics</CardTitle>
                <CardDescription>Newly onboarded tenants</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setView("clinics")}
              >
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

          {/* Top clinics leaderboard */}
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-base">Top clinics this week</CardTitle>
              <CardDescription>Ranked by booking volume</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-2">
              {loading ? (
                <ListSkeleton rows={5} />
              ) : topClinics.length > 0 ? (
                <ul>
                  {topClinics.map((c, i) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                          i === 0
                            ? "bg-[color:var(--chart-3)]/18 text-[color:var(--chart-3)]"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="w-40 min-w-0 shrink-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">/{c.slug}</p>
                      </div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[color:var(--chart-1)] to-primary"
                          style={{ width: `${(c.bookings / maxBookings) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {c.bookings}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyMsg text="No booking activity yet" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rail */}
        <div className="flex w-full flex-col gap-4 lg:sticky lg:top-20 lg:w-[300px] lg:shrink-0">
          <div>
            <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Needs attention
            </p>
            <Card className="border-border/70 shadow-sm">
              <CardContent className="space-y-1 p-1.5">
                {loading ? (
                  <ListSkeleton rows={2} />
                ) : renewalsCount === 0 && unassignedEnquiries === 0 ? (
                  <EmptyMsg text="All caught up" />
                ) : (
                  <>
                    {renewalsCount > 0 && (
                      <div className="flex items-start gap-3 rounded-lg p-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                          <CalendarClock className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-lg font-semibold tabular-nums">{renewalsCount}</p>
                          <p className="text-xs font-medium">
                            Renewals due in {renewalsWindow} days
                          </p>
                          {nextRenewal && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              Next: {nextRenewal.name} · {nextRenewal.daysAway}d
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {unassignedEnquiries > 0 && (
                      <div className="flex items-start gap-3 rounded-lg p-3">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color:var(--chart-4)]/12 text-[color:var(--chart-4)]">
                          <Inbox className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-lg font-semibold tabular-nums">
                            {unassignedEnquiries}
                          </p>
                          <p className="text-xs font-medium">Enquiries unassigned 48h+</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Enquiries funnel</p>
                <p className="text-xs text-muted-foreground">
                  Conv.{" "}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {funnelConv}%
                  </span>
                </p>
              </div>
              <div className="mt-2">
                {funnelSteps.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 border-b border-dashed border-border py-1.5 last:border-0"
                  >
                    <span className="w-[68px] shrink-0 text-xs text-muted-foreground">
                      {s.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          s.label === "Converted"
                            ? "bg-[color:var(--chart-2)]"
                            : "bg-[color:var(--chart-1)]"
                        }`}
                        style={{ width: `${(s.value / funnelMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mini stats
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <MiniStat
                label="Active clinics"
                value={activeClinics}
                icon={CheckCircle2}
                tone="chart-2"
              />
              <MiniStat label="Inactive" value={inactiveClinics} icon={PauseCircle} tone="muted" />
              <MiniStat
                label="New this week"
                value={newClinicsWeek + newApptsWeek}
                icon={TrendingUp}
                tone="primary"
              />
              <MiniStat
                label="Unresolved alerts"
                value={unresolvedAlerts}
                icon={Activity}
                tone={unresolvedAlerts > 0 ? "chart-3" : "muted"}
              />
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
