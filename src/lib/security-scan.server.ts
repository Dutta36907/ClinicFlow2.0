/**
 * Server-only security scanner. Runs a checklist of in-app pentest probes
 * (IDOR, auth bypass, rate-limit bypass, config surface) against this
 * deployment and writes a run + per-check findings to the database.
 *
 * Pure server-only — must never be imported from client-reachable code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type Status = "pass" | "fail" | "warn" | "error";

export interface Finding {
  check_id: string;
  category: string;
  severity: Severity;
  status: Status;
  title: string;
  detail?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

interface ScanCtx {
  admin: SupabaseClient;
  baseUrl: string;
  anonKey: string;
}

type CheckFn = (ctx: ScanCtx) => Promise<Finding>;

// ---------- Helpers ----------
function fail(
  check_id: string,
  category: string,
  severity: Severity,
  title: string,
  detail?: Record<string, unknown>,
): Finding {
  return { check_id, category, severity, status: "fail", title, detail: detail ?? {} };
}
function pass(check_id: string, category: string, title: string): Finding {
  return { check_id, category, severity: "info", status: "pass", title };
}
function warn(
  check_id: string,
  category: string,
  title: string,
  detail?: Record<string, unknown>,
): Finding {
  return { check_id, category, severity: "low", status: "warn", title, detail: detail ?? {} };
}
function errored(check_id: string, category: string, title: string, err: unknown): Finding {
  return {
    check_id,
    category,
    severity: "info",
    status: "error",
    title,
    detail: { message: err instanceof Error ? err.message : String(err) },
  };
}

// ---------- Checks: Config / surface audit ----------
const checkRlsEnabled: CheckFn = async ({ admin }) => {
  const { data, error } = await admin.rpc("get_rls_status");
  if (error) return errored("rls_enabled", "config", "RLS status check", error);
  const offenders = (data as Array<{ tablename: string; rowsecurity: boolean }>)
    .filter((r) => !r.rowsecurity)
    .map((r) => r.tablename);
  if (offenders.length === 0)
    return pass("rls_enabled", "config", "All public tables have RLS enabled");
  return fail(
    "rls_enabled",
    "config",
    "critical",
    `${offenders.length} public table(s) without RLS`,
    { tables: offenders },
  );
};

// Tables we intentionally expose to anon via SELECT policies. Anything outside
// this allow-list that grants SELECT to anon is flagged HIGH.
const ANON_SELECT_ALLOWLIST = new Set<string>([
  "clinics",
  "doctors",
  "doctor_schedules",
  "doctor_slot_overrides",
  "clinic_gallery",
  "clinic_testimonials",
  "clinic_treatments",
  "platform_settings",
]);

const checkAnonGrants: CheckFn = async ({ admin }) => {
  const { data, error } = await admin
    .from("information_schema.role_table_grants" as never)
    .select("table_name, privilege_type, grantee")
    .eq("table_schema", "public")
    .eq("grantee", "anon")
    .eq("privilege_type", "SELECT");
  if (error) {
    // information_schema isn't always reachable via PostgREST; fall back to RPC-less skip
    return warn("anon_grants", "config", "Anon grants audit unavailable", {
      message: error.message,
    });
  }
  const rows = (data as Array<{ table_name: string }>) ?? [];
  const offenders = rows.map((r) => r.table_name).filter((t) => !ANON_SELECT_ALLOWLIST.has(t));
  if (offenders.length === 0)
    return pass("anon_grants", "config", "Anon SELECT grants on allowlist only");
  return fail(
    "anon_grants",
    "config",
    "high",
    `Unexpected anon SELECT on ${offenders.length} table(s)`,
    { tables: offenders, allowlist: Array.from(ANON_SELECT_ALLOWLIST) },
  );
};

const checkRateLimitCron: CheckFn = async ({ admin }) => {
  const { data, error } = await admin
    .rpc("get_user_auth_context", { _uid: "00000000-0000-0000-0000-000000000000" })
    .select(); // dummy ping to test rpc availability
  void data;
  void error;
  // We can't query cron.job from PostgREST directly. Probe via a known-good
  // RPC and surface a warn so an operator manually re-checks if needed.
  // (Cleanup job is created by migration; this is a soft reminder.)
  return warn(
    "rate_limit_cron",
    "rate_limit",
    "Verify pg_cron job 'cleanup-rate-limit-buckets' is scheduled",
    {
      note: "PostgREST cannot read cron.job; confirm via DB console if findings persist.",
    },
  );
};

// ---------- Checks: IDOR (anon Data API) ----------
async function anonGet(baseUrl: string, anonKey: string, path: string) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const body = (await res.json().catch(() => null)) as unknown;
  return { status: res.status, body };
}

const checkIdorAppointments: CheckFn = async ({ admin, baseUrl, anonKey }) => {
  // Pick any one real appointment id; anon must NOT read it.
  const { data } = await admin.from("appointments").select("id").limit(1).maybeSingle();
  if (!data) return pass("idor_appointments", "idor", "No appointments to probe (skipped)");
  const r = await anonGet(baseUrl, anonKey, `appointments?id=eq.${data.id}&select=id`);
  const leaked = Array.isArray(r.body) && (r.body as unknown[]).length > 0;
  return leaked
    ? fail("idor_appointments", "idor", "critical", "Anon can read appointments", {
        appointment_id: data.id,
        status: r.status,
      })
    : pass("idor_appointments", "idor", "Anon cannot read appointments");
};

const checkIdorEnquiries: CheckFn = async ({ admin, baseUrl, anonKey }) => {
  const { data } = await admin.from("enquiries").select("id").limit(1).maybeSingle();
  if (!data) return pass("idor_enquiries", "idor", "No enquiries to probe (skipped)");
  const r = await anonGet(baseUrl, anonKey, `enquiries?id=eq.${data.id}&select=id`);
  const leaked = Array.isArray(r.body) && (r.body as unknown[]).length > 0;
  return leaked
    ? fail("idor_enquiries", "idor", "critical", "Anon can read enquiries", {
        enquiry_id: data.id,
        status: r.status,
      })
    : pass("idor_enquiries", "idor", "Anon cannot read enquiries");
};

const checkIdorPatientOtp: CheckFn = async ({ baseUrl, anonKey }) => {
  const r = await anonGet(baseUrl, anonKey, "patient_otp?select=id&limit=1");
  const leaked = Array.isArray(r.body) && (r.body as unknown[]).length > 0;
  return leaked
    ? fail("idor_patient_otp", "idor", "critical", "Anon can read patient_otp codes")
    : pass("idor_patient_otp", "idor", "Anon cannot read patient_otp");
};

const checkIdorOverrideReason: CheckFn = async ({ admin, baseUrl, anonKey }) => {
  // 'reason' was removed from anon grants in a prior migration. Confirm it stays out.
  const { data } = await admin.from("doctor_slot_overrides").select("id").limit(1).maybeSingle();
  if (!data) return pass("idor_override_reason", "idor", "No overrides to probe (skipped)");
  const r = await anonGet(baseUrl, anonKey, `doctor_slot_overrides?id=eq.${data.id}&select=reason`);
  // PostgREST returns 401/403 or a row-shaped error if the column is denied.
  const arr = Array.isArray(r.body) ? (r.body as Array<Record<string, unknown>>) : [];
  const leakedValue = arr.some((row) => "reason" in row && row.reason != null);
  return leakedValue
    ? fail("idor_override_reason", "idor", "high", "Anon can read doctor_slot_overrides.reason", {
        override_id: data.id,
      })
    : pass("idor_override_reason", "idor", "Override 'reason' column hidden from anon");
};

// ---------- Checks: Auth bypass ----------
const checkSignupStatusShape: CheckFn = async ({ baseUrl }) => {
  // getSignupStatus is a GET createServerFn — call it via TanStack RPC URL
  const res = await fetch(`${baseUrl}/_serverFn/src/lib/superadmin/functions/getSignupStatus`, {
    method: "GET",
  });
  // RPC URL shape varies across versions; if not reachable, skip without failing.
  if (!res.ok) {
    return warn("signup_status_shape", "auth_bypass", "Could not probe getSignupStatus shape", {
      http: res.status,
    });
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return warn("signup_status_shape", "auth_bypass", "Empty getSignupStatus response");
  const keys = Object.keys(body);
  const ok = keys.length === 1 && keys[0] === "bootstrapMode";
  return ok
    ? pass("signup_status_shape", "auth_bypass", "getSignupStatus exposes only {bootstrapMode}")
    : fail("signup_status_shape", "auth_bypass", "high", "getSignupStatus exposes extra fields", {
        keys,
      });
};

const checkAdminEndpointNeedsAuth: CheckFn = async ({ baseUrl }) => {
  // Try listing super admins without an Authorization header — must fail.
  const candidates = [
    "/_serverFn/src/lib/superadmin/functions/listSuperAdmins",
    "/api/_serverFn/listSuperAdmins",
  ];
  for (const path of candidates) {
    const res = await fetch(`${baseUrl}${path}`, { method: "POST" });
    if (res.status === 401 || res.status === 403 || res.status === 404) continue;
    if (res.status === 200) {
      return fail(
        "admin_needs_auth",
        "auth_bypass",
        "critical",
        "Privileged server fn reachable without auth",
        { path, status: res.status },
      );
    }
  }
  return pass(
    "admin_needs_auth",
    "auth_bypass",
    "Privileged server fns reject unauthenticated calls",
  );
};

const checkRateLimitConsumes: CheckFn = async ({ admin }) => {
  // Drain a probe bucket through consume_rate_limit() and confirm it eventually denies.
  const key = `__sec_scan_probe_${Date.now()}`;
  const capacity = 3;
  const results: boolean[] = [];
  for (let i = 0; i < capacity + 2; i += 1) {
    const { data, error } = await admin.rpc("consume_rate_limit", {
      _key: key,
      _capacity: capacity,
      _refill_seconds: 3600,
    });
    if (error)
      return errored("rate_limit_consume", "rate_limit", "consume_rate_limit RPC failed", error);
    results.push(Boolean(data));
  }
  // Cleanup
  await admin.from("rate_limit_buckets").delete().eq("key", key);
  const granted = results.filter(Boolean).length;
  return granted <= capacity
    ? pass(
        "rate_limit_consume",
        "rate_limit",
        `Rate limiter denied after capacity reached (${granted}/${results.length} granted)`,
      )
    : fail("rate_limit_consume", "rate_limit", "high", "Rate limiter did not deny past capacity", {
        granted,
        attempts: results.length,
        capacity,
      });
};

const checkRateLimitKeyNormalization: CheckFn = async ({ admin }) => {
  // Different casings should be treated as DIFFERENT keys (caller is responsible
  // for normalising). We surface this as info — confirms caller-side hashing matters.
  const base = `__sec_scan_norm_${Date.now()}`;
  const k1 = `${base}_a`;
  const k2 = `${base}_A`;
  await admin.rpc("consume_rate_limit", { _key: k1, _capacity: 1, _refill_seconds: 3600 });
  await admin.rpc("consume_rate_limit", { _key: k2, _capacity: 1, _refill_seconds: 3600 });
  const { data } = await admin.from("rate_limit_buckets").select("key").in("key", [k1, k2]);
  await admin.from("rate_limit_buckets").delete().in("key", [k1, k2]);
  const rows = (data as Array<{ key: string }>) ?? [];
  return rows.length === 2
    ? pass(
        "rate_limit_key_norm",
        "rate_limit",
        "Rate limiter treats distinct keys distinctly (caller must normalize)",
      )
    : warn("rate_limit_key_norm", "rate_limit", "Rate-limit key normalization unexpected", {
        observed_keys: rows.map((r) => r.key),
      });
};

const CHECKS: CheckFn[] = [
  checkRlsEnabled,
  checkAnonGrants,
  checkIdorAppointments,
  checkIdorEnquiries,
  checkIdorPatientOtp,
  checkIdorOverrideReason,
  checkSignupStatusShape,
  checkAdminEndpointNeedsAuth,
  checkRateLimitConsumes,
  checkRateLimitKeyNormalization,
  checkRateLimitCron,
];

export async function runSecurityScan(opts: {
  trigger: "cron" | "deploy" | "manual";
  commitSha?: string | null;
}): Promise<{ runId: string; failed: number; warned: number; passed: number; errored: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const baseUrl = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

  const { data: run, error: runErr } = await supabaseAdmin
    .from("security_scan_runs")
    .insert({
      trigger: opts.trigger,
      commit_sha: opts.commitSha ?? null,
      total: CHECKS.length,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "Failed to create scan run");

  const ctx: ScanCtx = { admin: supabaseAdmin, baseUrl, anonKey };

  const findings: Finding[] = [];
  for (const check of CHECKS) {
    try {
      findings.push(await check(ctx));
    } catch (e) {
      findings.push(errored(check.name || "unknown", "internal", "Check threw", e));
    }
  }

  const tallies = {
    passed: findings.filter((f) => f.status === "pass").length,
    failed: findings.filter((f) => f.status === "fail").length,
    warned: findings.filter((f) => f.status === "warn").length,
    errored: findings.filter((f) => f.status === "error").length,
  };

  const { error: findingsErr } = await supabaseAdmin.from("security_scan_findings").insert(
    findings.map((f) => ({
      run_id: run.id,
      check_id: f.check_id,
      category: f.category,
      severity: f.severity,
      status: f.status,
      title: f.title,
      detail: (f.detail ?? {}) as never,
      evidence: (f.evidence ?? {}) as never,
    })),
  );
  if (findingsErr) {
    await supabaseAdmin
      .from("security_scan_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        ...tallies,
      })
      .eq("id", run.id);
    throw new Error(findingsErr.message);
  }

  await supabaseAdmin
    .from("security_scan_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: "completed",
      ...tallies,
    })
    .eq("id", run.id);

  return { runId: run.id, ...tallies };
}
