/**
 * Dashboard server aggregators.
 *
 * One round-trip per dashboard view, in place of N parallel client queries:
 *   - getSuperAdminDashboard  → KPI grid + top-booking clinics + recent activity
 *   - getSuperAdminMonitoring → real infra metrics (DB latency, server-fn p50/p95, sessions)
 *   - getClinicManagerDashboard({ clinicId }) → clinic-scoped KPI strip
 *   - listSuperAdminAlerts / resolveSystemAlert → alerts table CRUD
 *   - listClinicsSummary / listEnquiriesAdmin    → paginated tables
 *
 * Auth model mirrors existing assertSuperAdmin / assertClinicAccess helpers
 * elsewhere in src/lib/*.functions.ts. All super-admin checks also block
 * disabled super admins per the project's core security rule.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarize, withSample } from "@/lib/server/metrics.server";

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

// ----------------------------------------------------------------------------
// Auth helpers (local copies of the existing patterns — see superadmin.functions.ts
// and clinicmanager.functions.ts for the originals).
// ----------------------------------------------------------------------------

async function assertSuperAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  // Single RPC round-trip — returns is_super, is_disabled, and clinic_ids.
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data)
    ? data[0]
    : (data as { is_super?: boolean; is_disabled?: boolean } | null);
  if (!row?.is_super) throw new Error("Not authorized");
  if (row.is_disabled) throw new Error("Your account is disabled");
}

async function assertClinicAccess(userId: string, clinicId: string) {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data)
    ? data[0]
    : (data as { is_super?: boolean; is_disabled?: boolean; clinic_ids?: string[] } | null);
  if (row?.is_super) {
    if (row.is_disabled) throw new Error("Your account is disabled");
    return;
  }
  if (!(row?.clinic_ids ?? []).includes(clinicId)) throw new Error("Not authorized");
}

// ----------------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW_DAYS = 14;

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function trend(curr: number, prev: number): { delta: number; dir: "up" | "down" | "flat" } {
  const delta = curr - prev;
  return { delta, dir: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
}

// ----------------------------------------------------------------------------
// Super Admin: KPI dashboard
// ----------------------------------------------------------------------------

export type SuperAdminDashboardDTO = {
  clinics: {
    total: number;
    active: number;
    inactive: number;
    newThisWeek: number;
    trendVsPrev: { delta: number; dir: "up" | "down" | "flat" };
  };
  doctors: { total: number; active: number };
  appointments: { total: number; pending: number; newThisWeek: number };
  users: { total: number };
  enquiries: {
    totalLast7d: number;
    newCount: number;
    inProgressCount: number;
    contactedCount: number;
    convertedCount: number;
    trendVsPrev: { delta: number; dir: "up" | "down" | "flat" };
  };
  pendingActions: { pendingAppts: number; unassignedEnquiriesOver48h: number };
  renewals: {
    dueWithinDays: number;
    count: number;
    nextClinic: { id: string; name: string; expiresAt: string; daysAway: number } | null;
  };
  topBookingClinics: { id: string; name: string; slug: string; bookings: number }[];
  systemHealth: {
    dbReachable: boolean;
    dbLatencyMs: number;
    unresolvedAlerts: number;
    lastAlertAt: string | null;
  };
  recentActivity: {
    id: string;
    kind: "appointment" | "clinic" | "enquiry" | "audit";
    title: string;
    subtitle: string;
    at: string;
  }[];
  recentClinicsList: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
  }[];
  recentApptsList: {
    id: string;
    patient_name: string;
    status: string;
    scheduled_at: string;
    clinic_id: string;
  }[];
};

export const getSuperAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminDashboardDTO> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    return withSample("getSuperAdminDashboard", async () => {
      const weekAgo = isoDaysAgo(7);
      const twoWeeksAgo = isoDaysAgo(14);
      const fortyEightHoursAgo = isoDaysAgo(2);
      const renewalCutoff = isoDaysFromNow(RENEWAL_WINDOW_DAYS);

      const t0 = Date.now();

      const [
        clinicsTotal,
        clinicsActive,
        clinicsNewWeek,
        clinicsNewPrevWeek,
        doctorsTotal,
        doctorsActive,
        apptsTotal,
        apptsNewWeek,
        usersTotal,
        enqLast7d,
        enqPrev7d,
        enqNew,
        enqInProgress,
        enqContacted,
        enqConverted,
        apptsPending,
        enqUnassignedStale,
        renewalsCount,
        renewalsNext,
        topBookingsRaw,
        alertsUnresolved,
        lastAlert,
        recentAppts,
        recentClinics,
        recentAudits,
      ] = await Promise.all([
        supabaseAdmin.from("clinics").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("clinics")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabaseAdmin
          .from("clinics")
          .select("id", { count: "exact", head: true })
          .gt("created_at", weekAgo),
        supabaseAdmin
          .from("clinics")
          .select("id", { count: "exact", head: true })
          .gt("created_at", twoWeeksAgo)
          .lte("created_at", weekAgo),
        supabaseAdmin.from("doctors").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("doctors")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gt("created_at", weekAgo),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .gt("created_at", weekAgo),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .gt("created_at", twoWeeksAgo)
          .lte("created_at", weekAgo),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress"),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "contacted"),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "converted"),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .is("assigned_to", null)
          .lte("created_at", fortyEightHoursAgo)
          .eq("status", "new"),
        supabaseAdmin
          .from("clinics")
          .select("id", { count: "exact", head: true })
          .not("expires_at", "is", null)
          .lte("expires_at", renewalCutoff)
          .gte("expires_at", new Date().toISOString()),
        supabaseAdmin
          .from("clinics")
          .select("id, name, expires_at")
          .not("expires_at", "is", null)
          .gte("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("appointments")
          .select("clinic_id")
          .gt("created_at", weekAgo)
          .limit(5000),
        supabaseAdmin
          .from("system_alerts")
          .select("id", { count: "exact", head: true })
          .is("resolved_at", null),
        supabaseAdmin
          .from("system_alerts")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("appointments")
          .select("id, patient_name, status, scheduled_at, created_at, clinic_id")
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("clinics")
          .select("id, name, slug, is_active, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabaseAdmin
          .from("audit_log")
          .select("id, action, created_at, target_type, clinic_id")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const dbLatencyMs = Date.now() - t0;
      const dbReachable = !clinicsTotal.error;

      // Top-5 by booking count (JS group; capped 5000 rows fits comfortably for
      // weekly traffic at 100k-registered scale).
      const bookingCounts = new Map<string, number>();
      for (const row of topBookingsRaw.data ?? []) {
        const cid = (row as { clinic_id: string }).clinic_id;
        bookingCounts.set(cid, (bookingCounts.get(cid) ?? 0) + 1);
      }
      const topClinicIds = Array.from(bookingCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const topClinicMeta = topClinicIds.length
        ? await supabaseAdmin
            .from("clinics")
            .select("id, name, slug")
            .in(
              "id",
              topClinicIds.map(([id]) => id),
            )
        : { data: [] };
      const metaById = new Map((topClinicMeta.data ?? []).map((c) => [c.id, c]));
      const topBookingClinics = topClinicIds.map(([id, bookings]) => {
        const meta = metaById.get(id);
        return { id, name: meta?.name ?? "Unknown", slug: meta?.slug ?? "", bookings };
      });

      // Merge recent activity into a unified stream.
      const recentActivity: SuperAdminDashboardDTO["recentActivity"] = [];
      for (const a of recentAppts.data ?? []) {
        recentActivity.push({
          id: `appt-${a.id}`,
          kind: "appointment",
          title: `Booking · ${a.patient_name}`,
          subtitle: `${a.status} · ${new Date(a.scheduled_at).toLocaleString()}`,
          at: a.created_at,
        });
      }
      for (const c of recentClinics.data ?? []) {
        recentActivity.push({
          id: `clinic-${c.id}`,
          kind: "clinic",
          title: `Clinic created · ${c.name}`,
          subtitle: `/${c.slug}`,
          at: c.created_at,
        });
      }
      for (const r of recentAudits.data ?? []) {
        recentActivity.push({
          id: `audit-${r.id}`,
          kind: "audit",
          title: r.action,
          subtitle: r.target_type ?? "system",
          at: r.created_at,
        });
      }
      recentActivity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

      const totalClinics = clinicsTotal.count ?? 0;
      const activeClinics = clinicsActive.count ?? 0;
      const newThisWeek = clinicsNewWeek.count ?? 0;
      const newPrevWeek = clinicsNewPrevWeek.count ?? 0;
      const enqLast7 = enqLast7d.count ?? 0;
      const enqPrev7 = enqPrev7d.count ?? 0;

      let nextClinic: SuperAdminDashboardDTO["renewals"]["nextClinic"] = null;
      if (renewalsNext.data?.expires_at) {
        const daysAway = Math.max(
          0,
          Math.round(
            (+new Date(renewalsNext.data.expires_at) - Date.now()) / (24 * 60 * 60 * 1000),
          ),
        );
        nextClinic = {
          id: renewalsNext.data.id,
          name: renewalsNext.data.name,
          expiresAt: renewalsNext.data.expires_at,
          daysAway,
        };
      }

      return {
        clinics: {
          total: totalClinics,
          active: activeClinics,
          inactive: totalClinics - activeClinics,
          newThisWeek,
          trendVsPrev: trend(newThisWeek, newPrevWeek),
        },
        doctors: {
          total: doctorsTotal.count ?? 0,
          active: doctorsActive.count ?? 0,
        },
        appointments: {
          total: apptsTotal.count ?? 0,
          pending: apptsPending.count ?? 0,
          newThisWeek: apptsNewWeek.count ?? 0,
        },
        users: {
          total: usersTotal.count ?? 0,
        },
        enquiries: {
          totalLast7d: enqLast7,
          newCount: enqNew.count ?? 0,
          inProgressCount: enqInProgress.count ?? 0,
          contactedCount: enqContacted.count ?? 0,
          convertedCount: enqConverted.count ?? 0,
          trendVsPrev: trend(enqLast7, enqPrev7),
        },
        pendingActions: {
          pendingAppts: apptsPending.count ?? 0,
          unassignedEnquiriesOver48h: enqUnassignedStale.count ?? 0,
        },
        renewals: {
          dueWithinDays: RENEWAL_WINDOW_DAYS,
          count: renewalsCount.count ?? 0,
          nextClinic,
        },
        topBookingClinics,
        systemHealth: {
          dbReachable,
          dbLatencyMs,
          unresolvedAlerts: alertsUnresolved.count ?? 0,
          lastAlertAt: lastAlert.data?.created_at ?? null,
        },
        recentActivity: recentActivity.slice(0, 12),
        recentClinicsList: (recentClinics.data ??
          []) as SuperAdminDashboardDTO["recentClinicsList"],
        recentApptsList: (recentAppts.data ?? []).slice(0, 6).map((a) => ({
          id: a.id,
          patient_name: a.patient_name,
          status: a.status,
          scheduled_at: a.scheduled_at,
          clinic_id: a.clinic_id,
        })) as SuperAdminDashboardDTO["recentApptsList"],
      };
    });
  });

// ----------------------------------------------------------------------------
// Super Admin: System Monitor (real metrics only)
// ----------------------------------------------------------------------------

export type SuperAdminMonitoringDTO = {
  db: { reachable: boolean; latencyMs: number };
  totals: {
    clinics: number;
    doctors: number;
    appointments: number;
    enquiries: number;
    profiles: number;
  };
  last24h: {
    newAppointments: number;
    newEnquiries: number;
    cancelledAppointments: number;
    auditEvents: number;
  };
  serverFns: {
    last5m: { sampleCount: number; p50Ms: number; p95Ms: number; errorRate: number };
    last1h: { sampleCount: number; p50Ms: number; p95Ms: number; errorRate: number };
  };
  sessions: { activeLast30m: number };
  alerts: { unresolved: number; lastAt: string | null };
  lastAudit: { action: string; created_at: string } | null;
  /** Metrics intentionally absent because the Worker runtime can't measure them. */
  unavailableMetrics: string[];
};

export const getSuperAdminMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminMonitoringDTO> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    return withSample("getSuperAdminMonitoring", async () => {
      const since24 = isoDaysAgo(1);
      const since30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const t0 = Date.now();

      const [
        clinics,
        doctors,
        appts,
        enquiries,
        profiles,
        apptsNew,
        enquiriesNew,
        cancelled,
        audits24h,
        activeSessions,
        alertsUnresolved,
        lastAlert,
        lastAuditRow,
      ] = await Promise.all([
        supabaseAdmin.from("clinics").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("doctors").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("enquiries").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gt("created_at", since24),
        supabaseAdmin
          .from("enquiries")
          .select("id", { count: "exact", head: true })
          .gt("created_at", since24),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "cancelled")
          .gt("updated_at", since24),
        supabaseAdmin
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .gt("created_at", since24),
        supabaseAdmin
          .from("audit_log")
          .select("actor_user_id")
          .gt("created_at", since30m)
          .limit(1000),
        supabaseAdmin
          .from("system_alerts")
          .select("id", { count: "exact", head: true })
          .is("resolved_at", null),
        supabaseAdmin
          .from("system_alerts")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("audit_log")
          .select("action, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const dbLatencyMs = Date.now() - t0;
      const dbReachable = !clinics.error;

      const activeUserSet = new Set<string>();
      for (const row of activeSessions.data ?? []) {
        const uid = (row as { actor_user_id: string | null }).actor_user_id;
        if (uid) activeUserSet.add(uid);
      }

      return {
        db: { reachable: dbReachable, latencyMs: dbLatencyMs },
        totals: {
          clinics: clinics.count ?? 0,
          doctors: doctors.count ?? 0,
          appointments: appts.count ?? 0,
          enquiries: enquiries.count ?? 0,
          profiles: profiles.count ?? 0,
        },
        last24h: {
          newAppointments: apptsNew.count ?? 0,
          newEnquiries: enquiriesNew.count ?? 0,
          cancelledAppointments: cancelled.count ?? 0,
          auditEvents: audits24h.count ?? 0,
        },
        serverFns: {
          last5m: summarize(5 * 60),
          last1h: summarize(60 * 60),
        },
        sessions: { activeLast30m: activeUserSet.size },
        alerts: {
          unresolved: alertsUnresolved.count ?? 0,
          lastAt: lastAlert.data?.created_at ?? null,
        },
        lastAudit: lastAuditRow.data
          ? {
              action: lastAuditRow.data.action as string,
              created_at: lastAuditRow.data.created_at as string,
            }
          : null,
        unavailableMetrics: [
          "CPU usage",
          "RAM usage",
          "Disk free / disk usage",
          "Event-loop latency",
          "Cache hit/miss",
          "Network bandwidth",
        ],
      };
    });
  });

// ----------------------------------------------------------------------------
// Clinic Manager dashboard (scoped)
// ----------------------------------------------------------------------------

export type ClinicManagerDashboardDTO = {
  clinic: {
    id: string;
    name: string;
    plan: string | null;
    expiresAt: string | null;
    trialEndsAt: string | null;
  };
  appointments: {
    today: number;
    thisWeek: number;
    lastWeek: number;
    confirmationRate: number; // 0..1 over last 100
  };
  renewal: {
    daysUntilExpiry: number | null;
    daysUntilTrialEnd: number | null;
    status: "ok" | "soon" | "urgent" | "expired" | "no-plan";
  };
  topDoctor: { id: string; name: string; bookings: number } | null;
  recentActivity: {
    id: string;
    kind: "appointment" | "audit";
    title: string;
    subtitle: string;
    at: string;
  }[];
};

export const getClinicManagerDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClinicManagerDashboardDTO> => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinicId);
    return withSample("getClinicManagerDashboard", async () => {
      const weekAgo = isoDaysAgo(7);
      const twoWeeksAgo = isoDaysAgo(14);
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);

      const [
        clinicRow,
        todayCount,
        weekCount,
        prevWeekCount,
        last100,
        topBookingsRaw,
        recentAppts,
        recentAudits,
      ] = await Promise.all([
        supabaseAdmin
          .from("clinics")
          .select("id, name, plan, expires_at, trial_ends_at")
          .eq("id", data.clinicId)
          .maybeSingle(),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", data.clinicId)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString()),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", data.clinicId)
          .gt("created_at", weekAgo),
        supabaseAdmin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", data.clinicId)
          .gt("created_at", twoWeeksAgo)
          .lte("created_at", weekAgo),
        supabaseAdmin
          .from("appointments")
          .select("status")
          .eq("clinic_id", data.clinicId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("appointments")
          .select("doctor_id")
          .eq("clinic_id", data.clinicId)
          .gt("created_at", weekAgo)
          .limit(2000),
        supabaseAdmin
          .from("appointments")
          .select("id, patient_name, status, scheduled_at, created_at, doctor_id")
          .eq("clinic_id", data.clinicId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("audit_log")
          .select("id, action, created_at, target_type")
          .eq("clinic_id", data.clinicId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (!clinicRow.data) throw new Error("Clinic not found");

      // Confirmation rate from last 100
      const last = last100.data ?? [];
      const confirmed = last.filter(
        (r) => r.status === "confirmed" || r.status === "completed",
      ).length;
      const confirmationRate = last.length === 0 ? 0 : confirmed / last.length;

      // Top doctor
      const dCount = new Map<string, number>();
      for (const r of topBookingsRaw.data ?? []) {
        const did = (r as { doctor_id: string }).doctor_id;
        dCount.set(did, (dCount.get(did) ?? 0) + 1);
      }
      const top = Array.from(dCount.entries()).sort((a, b) => b[1] - a[1])[0];
      let topDoctor: ClinicManagerDashboardDTO["topDoctor"] = null;
      if (top) {
        const { data: doc } = await supabaseAdmin
          .from("doctors")
          .select("id, name")
          .eq("id", top[0])
          .maybeSingle();
        topDoctor = { id: top[0], name: doc?.name ?? "Doctor", bookings: top[1] };
      }

      // Renewal status
      const c = clinicRow.data;
      const daysUntilExpiry = c.expires_at
        ? Math.round((+new Date(c.expires_at) - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      const daysUntilTrialEnd = c.trial_ends_at
        ? Math.round((+new Date(c.trial_ends_at) - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      const relevantDays = daysUntilTrialEnd ?? daysUntilExpiry;
      let status: ClinicManagerDashboardDTO["renewal"]["status"] = "no-plan";
      if (relevantDays !== null) {
        if (relevantDays < 0) status = "expired";
        else if (relevantDays <= 3) status = "urgent";
        else if (relevantDays <= 14) status = "soon";
        else status = "ok";
      }

      const recentActivity: ClinicManagerDashboardDTO["recentActivity"] = [];
      for (const a of recentAppts.data ?? []) {
        recentActivity.push({
          id: `appt-${a.id}`,
          kind: "appointment",
          title: `Booking · ${a.patient_name}`,
          subtitle: `${a.status} · ${new Date(a.scheduled_at).toLocaleString()}`,
          at: a.created_at,
        });
      }
      for (const r of recentAudits.data ?? []) {
        recentActivity.push({
          id: `audit-${r.id}`,
          kind: "audit",
          title: r.action,
          subtitle: r.target_type ?? "system",
          at: r.created_at,
        });
      }
      recentActivity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

      return {
        clinic: {
          id: c.id,
          name: c.name,
          plan: c.plan,
          expiresAt: c.expires_at,
          trialEndsAt: c.trial_ends_at,
        },
        appointments: {
          today: todayCount.count ?? 0,
          thisWeek: weekCount.count ?? 0,
          lastWeek: prevWeekCount.count ?? 0,
          confirmationRate,
        },
        renewal: { daysUntilExpiry, daysUntilTrialEnd, status },
        topDoctor,
        recentActivity: recentActivity.slice(0, 10),
      };
    });
  });

// ----------------------------------------------------------------------------
// System Alerts table
// ----------------------------------------------------------------------------

export type SystemAlertRow = {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string | null;
  source: string | null;
  resolved_at: string | null;
  created_at: string;
};

export const listSuperAdminAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        level: z.enum(["info", "warning", "critical"]).optional(),
        unresolvedOnly: z.boolean().default(false),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: SystemAlertRow[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin.from("system_alerts").select("*", { count: "exact" });
    if (data.level) q = q.eq("level", data.level);
    if (data.unresolvedOnly) q = q.is("resolved_at", null);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      count,
      error,
    } = await q.order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as SystemAlertRow[], total: count ?? 0 };
  });

export const resolveSystemAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("system_alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// Clinic Summary table (paginated, super-admin)
// ----------------------------------------------------------------------------

export type ClinicSummaryRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  plan: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  appointments_this_week: number;
  is_top_booking: boolean;
};

export const listClinicsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        search: z.string().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: ClinicSummaryRow[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const weekAgo = isoDaysAgo(7);
    let q = supabaseAdmin
      .from("clinics")
      .select("id, name, slug, is_active, plan, expires_at, trial_ends_at", { count: "exact" });
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      count,
      error,
    } = await q.order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const perClinic = new Map<string, number>();
    if (ids.length) {
      const { data: appts } = await supabaseAdmin
        .from("appointments")
        .select("clinic_id")
        .in("clinic_id", ids)
        .gt("created_at", weekAgo)
        .limit(5000);
      for (const a of appts ?? []) {
        const cid = (a as { clinic_id: string }).clinic_id;
        perClinic.set(cid, (perClinic.get(cid) ?? 0) + 1);
      }
    }
    const sorted = Array.from(perClinic.entries()).sort((a, b) => b[1] - a[1]);
    const topIds = new Set(sorted.slice(0, 5).map(([id]) => id));

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        appointments_this_week: perClinic.get(r.id) ?? 0,
        is_top_booking: topIds.has(r.id),
      })) as ClinicSummaryRow[],
      total: count ?? 0,
    };
  });

// ----------------------------------------------------------------------------
// Enquiry table (paginated, super-admin)
// ----------------------------------------------------------------------------

export type EnquiryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string | null;
  enquiry_type: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
};

export const listEnquiriesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        status: z.string().max(40).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: EnquiryRow[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin
      .from("enquiries")
      .select(
        "id, full_name, email, phone, company_name, enquiry_type, status, assigned_to, created_at",
        { count: "exact" },
      );
    if (data.status) q = q.eq("status", data.status);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      count,
      error,
    } = await q.order("created_at", { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as EnquiryRow[], total: count ?? 0 };
  });
