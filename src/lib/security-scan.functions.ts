import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdminClient() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

async function assertSuperAdmin(userId: string) {
  const admin = await getAdminClient();
  const { data, error } = await admin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : (data as { is_super?: boolean; is_disabled?: boolean } | null);
  if (!row?.is_super) throw new Error("Not authorized");
  if (row.is_disabled) throw new Error("Your account is disabled");
}

/** Trigger a security scan run from the super-admin UI. */
export const runSecurityScanNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { runSecurityScan } = await import("./security-scan.server");
    return runSecurityScan({ trigger: "manual" });
  });

/** List most recent scan runs (paged). */
export const listSecurityRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(25) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const admin = await getAdminClient();
    const { data: rows, error } = await admin
      .from("security_scan_runs")
      .select("id, started_at, finished_at, trigger, commit_sha, total, passed, failed, warned, errored, status")
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { runs: rows ?? [] };
  });

/** Fetch one run with all findings. */
export const getSecurityRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const admin = await getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("security_scan_runs")
      .select("*")
      .eq("id", data.runId)
      .maybeSingle();
    if (runErr) throw new Error(runErr.message);
    if (!run) throw new Error("Run not found");
    const { data: findings, error: findErr } = await admin
      .from("security_scan_findings")
      .select("id, check_id, category, severity, status, title, detail, evidence, created_at")
      .eq("run_id", data.runId)
      .order("severity", { ascending: false })
      .order("category", { ascending: true });
    if (findErr) throw new Error(findErr.message);
    return { run, findings: findings ?? [] };
  });
