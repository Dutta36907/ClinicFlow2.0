// Platform health snapshot — read-only.
// Single aggregator (getSuperAdminMonitoring) feeds the totals, DB reachability,
// last-24h counts, server-fn perf, sessions, alerts.lastAt and lastAudit. The
// only second call is the unresolved alerts list (not summarised by the aggregator).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSuperAdminMonitoring } from "@/lib/dashboard.functions";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Database, AlertCircle, CheckCircle2, Clock, Gauge, Activity, AlertTriangle, BarChart3 } from "lucide-react";
import { MiniStat } from "./shared";
import {
  Building2,
  Stethoscope,
  CalendarDays,
  Inbox,
  Users,
} from "lucide-react";


export function MonitoringView() {
  const qc = useQueryClient();

  const fetchMonitoring = useServerFn(getSuperAdminMonitoring);
  const q = useQuery({
    queryKey: ["sa-monitoring"],
    queryFn: () => fetchMonitoring(),
    refetchInterval: 60_000,
  });

  const data = q.data;

  // Unresolved operational alerts list — not summarised by the aggregator.
  const alertsQ = useQuery({
    queryKey: ["sa-system-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_alerts")
        .select("id, level, title, body, source, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [] as Array<{ id: string; level: string; title: string; body: string | null; source: string | null; created_at: string }>;
      return (data ?? []) as Array<{ id: string; level: string; title: string; body: string | null; source: string | null; created_at: string }>;
    },
    refetchInterval: 30_000,
  });

  const perf = data?.serverFns.last5m;


  return (
    <SuperAdminLayout
      title="System Monitoring"
      subtitle="Live health snapshot of the platform"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["sa-monitoring"] })}
          className="gap-2"
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {/* Unresolved alerts banner — refreshes every 30s */}
      {alertsQ.data && alertsQ.data.length > 0 && (
        <Card className="mb-4 border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              Unresolved alerts ({alertsQ.data.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {alertsQ.data.slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">
                    <span className="mr-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold uppercase text-destructive">
                      {a.level}
                    </span>
                    {a.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Health banner */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {data?.db.reachable ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {data ? (data.db.reachable ? "Healthy" : "Degraded") : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Round-trip {data ? `${data.db.latencyMs} ms` : "…"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              Last audit event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-2xl font-semibold">
              {data?.lastAudit ? data.lastAudit.action : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.lastAudit
                ? new Date(data.lastAudit.created_at).toLocaleString()
                : "No events recorded"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="size-4 text-muted-foreground" />
              Build
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{import.meta.env.MODE}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-refresh every 60s
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Server performance
        </h2>
        <p className="text-xs text-muted-foreground">
          Rolling 5-minute window · current server instance only
        </p>
      </div>
      <PerfRow perf={perf} loading={q.isLoading} />




      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Table totals
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Clinics" value={data?.totals.clinics ?? 0} icon={Building2} tone="primary" />
        <MiniStat label="Doctors" value={data?.totals.doctors ?? 0} icon={Stethoscope} tone="chart-1" />
        <MiniStat label="Appointments" value={data?.totals.appointments ?? 0} icon={CalendarDays} tone="chart-2" />
        <MiniStat label="Enquiries" value={data?.totals.enquiries ?? 0} icon={Inbox} tone="chart-3" />
        <MiniStat label="Profiles" value={data?.totals.profiles ?? 0} icon={Users} tone="chart-4" />
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Last 24 hours
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="New appointments" value={data?.last24h.newAppointments ?? 0} icon={CalendarDays} tone="chart-2" />
        <MiniStat label="New enquiries" value={data?.last24h.newEnquiries ?? 0} icon={Inbox} tone="chart-3" />
        <MiniStat label="Cancelled appointments" value={data?.last24h.cancelledAppointments ?? 0} icon={AlertCircle} tone="muted" />
      </div>
    </SuperAdminLayout>
  );
}

type PerfSummary = {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  errorRate: number;
};


function PerfRow({ perf, loading }: { perf: PerfSummary | undefined; loading: boolean }) {
  const cold = !loading && (!perf || perf.sampleCount === 0);
  const fmtMs = (n: number) => (cold ? "—" : `${n.toLocaleString()} ms`);
  const errPct = perf ? perf.errorRate * 100 : 0;
  const errHot = errPct > 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PerfTile label="p50 latency" value={perf ? fmtMs(perf.p50Ms) : "…"} icon={Gauge} tone="chart-2" />
      <PerfTile label="p95 latency" value={perf ? fmtMs(perf.p95Ms) : "…"} icon={Activity} tone="chart-1" />
      <PerfTile
        label="Error rate"
        value={cold ? "—" : perf ? `${errPct.toFixed(1)}%` : "…"}
        icon={AlertTriangle}
        tone={errHot ? "destructive" : "muted"}
      />
      <PerfTile
        label="Samples"
        value={perf ? perf.sampleCount.toLocaleString() : "…"}
        icon={BarChart3}
        tone="primary"
      />
    </div>
  );
}

function PerfTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  tone: "primary" | "chart-1" | "chart-2" | "muted" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary ring-primary/20",
    "chart-1": "bg-[color:var(--chart-1)]/10 text-[color:var(--chart-1)] ring-[color:var(--chart-1)]/20",
    "chart-2": "bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)] ring-[color:var(--chart-2)]/20",
    muted: "bg-muted text-muted-foreground ring-border",
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
  };
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-9 items-center justify-center rounded-md ring-1 ${toneMap[tone]}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
