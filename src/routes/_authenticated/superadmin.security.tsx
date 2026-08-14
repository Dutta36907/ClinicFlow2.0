import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  runSecurityScanNow,
  listSecurityRuns,
  getSecurityRun,
} from "@/lib/security-scan.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin/security")({
  head: () => ({ meta: [{ title: "Security Scans" }] }),
  component: SecurityScansPage,
});

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  commit_sha: string | null;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  errored: number;
  status: string;
};

type Finding = {
  id: string;
  check_id: string;
  category: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "pass" | "fail" | "warn" | "error";
  title: string;
  detail: Record<string, unknown>;
  evidence: Record<string, unknown>;
};

function sevColor(s: Finding["severity"]) {
  switch (s) {
    case "critical":
      return "bg-red-600 text-white";
    case "high":
      return "bg-red-500 text-white";
    case "medium":
      return "bg-amber-500 text-white";
    case "low":
      return "bg-yellow-400 text-black";
    default:
      return "bg-slate-300 text-black";
  }
}
function statusIcon(s: Finding["status"]) {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (s === "fail") return <AlertCircle className="h-4 w-4 text-red-600" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <AlertCircle className="h-4 w-4 text-slate-500" />;
}

function SecurityScansPage() {
  const qc = useQueryClient();
  const runFn = useServerFn(runSecurityScanNow);
  const listFn = useServerFn(listSecurityRuns);
  const getFn = useServerFn(getSecurityRun);
  const [selected, setSelected] = useState<string | null>(null);

  const runsQ = useQuery({
    queryKey: ["sec-scan-runs"],
    queryFn: () => listFn({ data: { limit: 25 } }),
    refetchInterval: 30_000,
  });

  const detailQ = useQuery({
    queryKey: ["sec-scan-run", selected],
    queryFn: () => getFn({ data: { runId: selected! } }),
    enabled: !!selected,
  });

  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      toast.success(`Scan complete — ${r.failed} failed, ${r.warned} warn, ${r.passed} pass`);
      qc.invalidateQueries({ queryKey: ["sec-scan-runs"] });
      setSelected(r.runId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Scan failed"),
  });

  const runs = (runsQ.data?.runs ?? []) as Run[];

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Security Scans</h1>
            <p className="text-sm text-muted-foreground">
              Automated IDOR, auth-bypass and rate-limit-bypass checks. Runs daily and on demand.
            </p>
          </div>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
          Run scan now
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet. Click "Run scan now".</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Started</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Pass</th>
                  <th>Fail</th>
                  <th>Warn</th>
                  <th>Err</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{new Date(r.started_at).toLocaleString()}</td>
                    <td>
                      <Badge variant="secondary">{r.trigger}</Badge>
                    </td>
                    <td>{r.status}</td>
                    <td>{r.passed}</td>
                    <td className={r.failed > 0 ? "text-red-600 font-semibold" : ""}>{r.failed}</td>
                    <td className={r.warned > 0 ? "text-amber-600" : ""}>{r.warned}</td>
                    <td>{r.errored}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
          </CardHeader>
          <CardContent>
            {detailQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-3">
                {((detailQ.data?.findings ?? []) as Finding[]).map((f) => (
                  <div key={f.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(f.status)}
                      <span className="font-medium">{f.title}</span>
                      <Badge className={sevColor(f.severity)}>{f.severity}</Badge>
                      <Badge variant="outline">{f.category}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{f.check_id}</span>
                    </div>
                    {Object.keys(f.detail || {}).length > 0 && (
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(f.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
