// Public, unauthenticated server functions for the patient booking flow.
//
// Reads of clinic-facing tables (clinics, doctors, treatments, testimonials,
// gallery, doctor_schedules, doctor_slot_overrides) go through a server
// publishable (anon-key) client, which is constrained by narrow `TO anon`
// SELECT policies — so a bug here cannot return inactive/expired clinics or
// unrelated columns. Privileged operations (patient_otp, audit_log,
// system_alerts, platform_settings, appointments writes, the appointments
// overlap check) lazy-load the service-role client only inside the handler
// that needs it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { assertRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { AppError, maskPhone } from "@/lib/errors";
import { logger } from "@/lib/logger.server";

const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9-]+$/i);

// Public booking reads go through the service-role admin client. The three
// recent security findings (clinics_notification_plan_fields_public,
// doctors_public_read_active_policy, doctor_slot_overrides_reason_public_rls)
// revoked anon SELECT on these tables, so anon-key reads now return
// "permission denied". The handlers below already constrain columns and
// is_active, and each endpoint is rate-limited per-IP — routing through the
// admin client preserves the security fix (anon stays locked) while keeping
// public landing/booking pages working.
async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}
const supabasePublic = getAdmin;

export const getClinicBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slugSchema.parse(d.slug.toLowerCase()) }))
  .handler(async ({ data }) => {
    // Cheap public read — generous bucket per IP to absorb crawlers/refresh.
    await assertRateLimit(`clinic:${getClientIp()}`, { capacity: 120, refillSeconds: 60, label: "page" });
    const sb = await supabasePublic();
    const { data: clinic, error } = await sb
      .from("clinics")
      .select(
        "id, slug, name, phone, email, whatsapp, website, google_map_url, description, tagline, address, logo_url, cover_image_url, performance_stats, timezone, working_hours, appointment_duration_minutes, is_active, expires_at"
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!clinic) return null;
    const expired = !!(clinic.expires_at && new Date(clinic.expires_at) < new Date());
    const status: "active" | "inactive" | "expired" = expired
      ? "expired"
      : !clinic.is_active
        ? "inactive"
        : "active";
    return { ...clinic, status };
  });

export const getClinicPageContent = createServerFn({ method: "GET" })
  .inputValidator((d: { clinicId: string }) => ({ clinicId: z.string().uuid().parse(d.clinicId) }))
  .handler(async ({ data }) => {
    await assertRateLimit(`pagecontent:${getClientIp()}`, { capacity: 120, refillSeconds: 60, label: "page content" });
    const sb = await supabasePublic();
    const [treatments, testimonials, gallery] = await Promise.all([
      sb
        .from("clinic_treatments")
        .select("id, title, description, icon, display_order")
        .eq("clinic_id", data.clinicId)
        .eq("is_active", true)
        .order("display_order")
        .order("created_at"),
      sb
        .from("clinic_testimonials")
        .select("id, patient_name, rating, quote, photo_url, review_date, is_featured")
        .eq("clinic_id", data.clinicId)
        .order("display_order")
        .order("created_at", { ascending: false }),
      sb
        .from("clinic_gallery")
        .select("id, image_url, caption")
        .eq("clinic_id", data.clinicId)
        .order("display_order")
        .order("created_at"),
    ]);
    return {
      treatments: treatments.data ?? [],
      testimonials: testimonials.data ?? [],
      gallery: gallery.data ?? [],
    };
  });

export const getDoctorsForClinic = createServerFn({ method: "GET" })
  .inputValidator((d: { clinicId: string }) => ({ clinicId: z.string().uuid().parse(d.clinicId) }))
  .handler(async ({ data }) => {
    await assertRateLimit(`doctors:${getClientIp()}`, { capacity: 120, refillSeconds: 60, label: "doctor list" });
    const sb = await supabasePublic();
    const { data: doctors, error } = await sb
      .from("doctors")
      .select("id, name, degree, photo_url, description, years_experience, specialization")
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return doctors ?? [];
  });

/**
 * Aggregated landing-page read — clinic + doctors + treatments + testimonials
 * + gallery in a single browser round-trip with one rate-limit bucket
 * (instead of 3 server-fn calls × 3 buckets from the route loader).
 */
export const getClinicLanding = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slugSchema.parse(d.slug.toLowerCase()) }))
  .handler(async ({ data }) => {
    await assertRateLimit(`landing:${getClientIp()}`, { capacity: 120, refillSeconds: 60, label: "landing page" });
    const sb = await supabasePublic();

    const { data: clinicRow, error: clinicErr } = await sb
      .from("clinics")
      .select(
        "id, slug, name, phone, email, whatsapp, website, google_map_url, description, tagline, address, logo_url, cover_image_url, performance_stats, timezone, working_hours, appointment_duration_minutes, is_active, expires_at"
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (clinicErr) throw new Error(clinicErr.message);
    if (!clinicRow) {
      return {
        clinic: null,
        doctors: [],
        content: { treatments: [], testimonials: [], gallery: [] },
      };
    }
    const expired = !!(clinicRow.expires_at && new Date(clinicRow.expires_at) < new Date());
    const status: "active" | "inactive" | "expired" = expired
      ? "expired"
      : !clinicRow.is_active
        ? "inactive"
        : "active";
    const clinic = { ...clinicRow, status };

    // Stop here for non-active clinics — landing UI shows the inactive/expired
    // screen and doesn't render doctors or content.
    if (status !== "active") {
      return {
        clinic,
        doctors: [],
        content: { treatments: [], testimonials: [], gallery: [] },
      };
    }

    const [doctorsRes, treatmentsRes, testimonialsRes, galleryRes] = await Promise.all([
      sb
        .from("doctors")
        .select("id, name, degree, photo_url, description, years_experience, specialization")
        .eq("clinic_id", clinic.id)
        .eq("is_active", true)
        .order("name"),
      sb
        .from("clinic_treatments")
        .select("id, title, description, icon, display_order")
        .eq("clinic_id", clinic.id)
        .eq("is_active", true)
        .order("display_order")
        .order("created_at"),
      sb
        .from("clinic_testimonials")
        .select("id, patient_name, rating, quote, photo_url, review_date, is_featured")
        .eq("clinic_id", clinic.id)
        .order("display_order")
        .order("created_at", { ascending: false }),
      sb
        .from("clinic_gallery")
        .select("id, image_url, caption")
        .eq("clinic_id", clinic.id)
        .order("display_order")
        .order("created_at"),
    ]);

    return {
      clinic,
      doctors: doctorsRes.data ?? [],
      content: {
        treatments: treatmentsRes.data ?? [],
        testimonials: testimonialsRes.data ?? [],
        gallery: galleryRes.data ?? [],
      },
    };
  });

// Public read of a single doctor profile + their weekly schedule and upcoming
// time-off overrides. Returns null when the doctor doesn't belong to the
// clinic or is inactive — callers should treat that as a 404.
export const getPublicDoctorProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { clinicId: string; doctorId: string }) => ({
    clinicId: z.string().uuid().parse(d.clinicId),
    doctorId: z.string().uuid().parse(d.doctorId),
  }))
  .handler(async ({ data }) => {
    await assertRateLimit(`doctor:${getClientIp()}`, { capacity: 120, refillSeconds: 60, label: "doctor profile" });
    const sb = await supabasePublic();
    const { data: doctor, error } = await sb
      .from("doctors")
      .select(
        "id, clinic_id, name, degree, photo_url, description, years_experience, specialization, is_active, appointment_duration_minutes, specialties, languages",
      )
      .eq("id", data.doctorId)
      .eq("clinic_id", data.clinicId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doctor) return null;

    const today = new Date().toISOString().slice(0, 10);
    const [schedRes, overrideRes] = await Promise.all([
      sb
        .from("doctor_schedules")
        .select("id, weekday, start_time, end_time, is_active")
        .eq("doctor_id", data.doctorId)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true }),
      sb
        .from("doctor_slot_overrides")
        .select("id, date, start_time, end_time, is_blocked")
        .eq("doctor_id", data.doctorId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(20),
    ]);
    return {
      doctor,
      schedules: schedRes.data ?? [],
      overrides: overrideRes.data ?? [],
    };
  });

const slotsInput = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slotsInput.parse(d))
  .handler(async ({ data }) => {
    // Anti-scraping cap on this unauthenticated lookup.
    await assertRateLimit(`slots:${getClientIp()}`, { capacity: 30, refillSeconds: 60, label: "slot lookup" });
    const { zonedWallTimeToUtc, utcToZonedParts } = await import("./clinic-time");
    const sb = await supabasePublic();

    const { data: doctor } = await sb
      .from("doctors")
      .select("id, clinic_id, appointment_duration_minutes")
      .eq("id", data.doctorId)
      .maybeSingle();
    if (!doctor) {
      return {
        slots: [] as { time: string; booked: boolean }[],
        duration: 0,
        timezone: "UTC",
        weeklyHours: [] as { weekday: number; start: string; end: string }[],
        workingWindows: [] as { start: string; end: string }[],
        timeOffBlocks: [] as { start: string | null; end: string | null }[],
        dayOff: false,
        fullyBlocked: false,
      };
    }

    const duration = doctor.appointment_duration_minutes ?? 15;

    const { data: clinic } = await sb
      .from("clinics")
      .select("timezone")
      .eq("id", doctor.clinic_id)
      .maybeSingle();
    const tz = clinic?.timezone || "UTC";

    // Weekday is the clinic-local weekday for the requested date.
    const weekdayProbe = zonedWallTimeToUtc(data.date, "12:00", tz);
    const weekday = utcToZonedParts(weekdayProbe, tz).weekday; // 0=Sun..6=Sat

    const { data: schedules } = await sb
      .from("doctor_schedules")
      .select("weekday, start_time, end_time, is_active")
      .eq("doctor_id", data.doctorId)
      .eq("is_active", true);

    const daySchedules = (schedules ?? []).filter((s) => s.weekday === weekday);

    const { data: overrides } = await sb
      .from("doctor_slot_overrides")
      .select("start_time, end_time, is_blocked")
      .eq("doctor_id", data.doctorId)
      .eq("date", data.date);

    const weeklyHours = (schedules ?? [])
      .map((s) => ({
        weekday: s.weekday as number,
        start: (s.start_time as string).slice(0, 5),
        end: (s.end_time as string).slice(0, 5),
      }))
      .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));

    const workingWindows = daySchedules
      .map((s) => ({
        start: (s.start_time as string).slice(0, 5),
        end: (s.end_time as string).slice(0, 5),
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    const timeOffBlocks = (overrides ?? [])
      .filter((o) => o.is_blocked)
      .map((o) => ({
        start: o.start_time ? (o.start_time as string).slice(0, 5) : null,
        end: o.end_time ? (o.end_time as string).slice(0, 5) : null,
      }));

    const dayOff = daySchedules.length === 0;
    const fullyBlocked = (overrides ?? []).some(
      (o) => o.is_blocked && !o.start_time && !o.end_time,
    );

    const base = {
      duration,
      timezone: tz,
      weeklyHours,
      workingWindows,
      timeOffBlocks,
      dayOff,
      fullyBlocked,
    };

    if (fullyBlocked || dayOff) {
      return { ...base, slots: [] as { time: string; booked: boolean }[] };
    }

    // Clinic-local 00:00 → next day 00:00, as UTC instants.
    const startOfDayUtc = zonedWallTimeToUtc(data.date, "00:00", tz).getTime();
    const endOfDayUtc = startOfDayUtc + 86_400_000;
    // Appointments table is not publicly readable; use the privileged client
    // for the overlap check only. We never return PII from these rows.
    const supabaseAdmin = await getAdmin();
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("scheduled_at, duration_minutes, status")
      .eq("doctor_id", data.doctorId)
      .gte("scheduled_at", new Date(startOfDayUtc).toISOString())
      .lt("scheduled_at", new Date(endOfDayUtc).toISOString())
      .in("status", ["pending", "confirmed", "rescheduled"]);

    // Overlap-aware blocking: a candidate [cursor, cursor+duration) is taken
    // if any active appointment's [start, start+appt.duration) overlaps it.
    const bookedRanges = (appts ?? []).map((a) => {
      const start = new Date(a.scheduled_at).getTime();
      const d = (a.duration_minutes as number | null) ?? duration;
      return { start, end: start + d * 60_000 };
    });

    const minBookableMs = Date.now() + 60_000; // ≥ 1 min lead time

    const tryPush = (cursor: number) => {
      const slotEnd = cursor + duration * 60_000;
      if (cursor < minBookableMs) return;
      const blockedByOff = overrides?.some((o) => {
        if (!o.is_blocked || !o.start_time || !o.end_time) return false;
        const bs = zonedWallTimeToUtc(data.date, o.start_time, tz).getTime();
        const be = zonedWallTimeToUtc(data.date, o.end_time, tz).getTime();
        // Any overlap between [cursor, slotEnd) and [bs, be) blocks the slot.
        return bs < slotEnd && be > cursor;
      });
      if (blockedByOff) return;
      const booked = bookedRanges.some((r) => r.start < slotEnd && r.end > cursor);
      slots.push({ time: new Date(cursor).toISOString(), booked });
    };

    const slots: { time: string; booked: boolean }[] = [];
    for (const sched of daySchedules) {
      let cursor = zonedWallTimeToUtc(data.date, sched.start_time, tz).getTime();
      const end = zonedWallTimeToUtc(data.date, sched.end_time, tz).getTime();
      while (cursor + duration * 60_000 <= end) {
        tryPush(cursor);
        cursor += duration * 60_000;
      }
      // Trailing extra slot: start at the window's closing time, run one
      // interval past it. Mirrors generateDoctorSlots so manager and patient
      // views stay in sync.
      tryPush(end);
    }
    return { ...base, slots };
  });

// ---------- OTP ----------
// Two delivery modes, selected by platform_settings.sms.provider:
//   - 'on_screen' (default): code is generated server-side and returned in
//     the response over HTTPS. No SMS is dispatched. Bound to the browser
//     session that requested it. 30s expiry. See requestOnScreenOtp.
//   - 'sms' provider id ('msg91' | 'twilio' | 'gupshup' | 'dev'): the
//     existing SMS dispatch path. The plaintext code is never returned
//     (except for 'dev' in non-production builds).

const phoneSchema = z.string().trim().min(6).max(20).regex(/^[+\d\s()-]+$/);
const sessionIdSchema = z.string().uuid();

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

/**
 * Public booking config — tells the booking UI whether to expect a code
 * in the response (on_screen / dev) or wait for an SMS (real provider).
 * Returns no secrets, no provider credentials, no identifying info.
 */
// M4: 60s in-memory cache. platform_settings.sms.provider rarely changes
// (operator toggles it once); reading service-role on every page hit is
// wasteful. Cache TTL keeps response < 1ms in steady state and bounds the
// staleness window when an operator switches providers.
let _bookingCfg: { value: { otpProvider: "on_screen" | "sms" | "dev" }; expires: number } | null = null;
export const getBookingConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const now = Date.now();
    if (_bookingCfg && _bookingCfg.expires > now) return _bookingCfg.value;
    const supabaseAdmin = await getAdmin();
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("sms")
      .limit(1)
      .maybeSingle();
    const provider = (data?.sms as { provider?: string } | null)?.provider ?? "on_screen";
    const otpProvider: "on_screen" | "sms" | "dev" =
      provider === "on_screen" ? "on_screen" : provider === "dev" ? "dev" : "sms";
    const value = { otpProvider };
    _bookingCfg = { value, expires: now + 60_000 };
    return value;
  },
);

/**
 * Request an on-screen OTP. The plaintext code is generated using Node's
 * cryptographically random `crypto.randomInt`, stored ONLY as a SHA-256
 * hash, returned ONCE in this response, and never logged or persisted in
 * plaintext.
 */
export const requestOnScreenOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; sessionId: string; clinicId?: string }) => ({
    phone: phoneSchema.parse(d.phone),
    sessionId: sessionIdSchema.parse(d.sessionId),
    clinicId: d.clinicId ? z.string().uuid().parse(d.clinicId) : undefined,
  }))
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    // Prevent any browser / intermediary from caching the plaintext code.
    setResponseHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    setResponseHeader("Pragma", "no-cache");
    setResponseHeader("X-Content-Type-Options", "nosniff");

    const clientIp = getClientIp();
    await assertRateLimit(`otp-screen:phone:${data.phone}`, {
      capacity: 3,
      refillSeconds: 600,
      label: "verification code",
    });
    await assertRateLimit(`otp-screen:ip:${clientIp}`, {
      capacity: 5,
      refillSeconds: 600,
      label: "verification code",
    });

    const { randomInt } = await import("crypto");
    // randomInt(min, max) — max is exclusive, so 1_000_000 gives [100000, 999999].
    const code = String(randomInt(100000, 1_000_000));
    const codeHash = hashCode(code);
    const sessionIdHash = hashSessionId(data.sessionId);
    const expiresAt = new Date(Date.now() + 30_000).toISOString();

    const supabaseAdmin = await getAdmin();
    // Invalidate any prior unconsumed on-screen OTP for this phone so the
    // newest code is always the only valid one.
    await supabaseAdmin
      .from("patient_otp")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", data.phone)
      .eq("method", "on_screen")
      .is("consumed_at", null);

    const { error } = await supabaseAdmin.from("patient_otp").insert({
      phone: data.phone,
      code_hash: codeHash,
      session_id_hash: sessionIdHash,
      expires_at: expiresAt,
      attempts: 0,
      method: "on_screen",
    });
    if (error) {
      throw new AppError("Could not generate verification code.", { code: "INTERNAL_ERROR", cause: error });
    }

    // Audit (no plaintext code, no full phone, no full session id).
    try {
      await supabaseAdmin.from("audit_log").insert({
        clinic_id: data.clinicId || null,
        action: "otp.on_screen.generate",
        target_type: "patient_otp",
        target_id: maskPhone(data.phone),
        metadata: { ip: clientIp, session_id_hash_prefix: sessionIdHash.slice(0, 8) },
      });
    } catch {
      /* best-effort */
    }

    logger.info({
      action: "otp_generated",
      method: "on_screen",
      phone_last4: data.phone.slice(-4),
      session_id_hash: sessionIdHash.slice(0, 8) + "...",
      expires_at: expiresAt,
    });

    return { ok: true as const, code, expiresAt };
  });

/**
 * Verify an on-screen OTP. Branches in the order: not found → expired →
 * attempts ceiling → session binding mismatch → code hash compare. The
 * attempts ceiling is checked BEFORE the code is compared so a locked-out
 * row never reveals whether the submitted code was correct.
 */
export const verifyOnScreenOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; sessionId: string }) => ({
    phone: phoneSchema.parse(d.phone),
    code: z.string().regex(/^\d{6}$/).parse(d.code),
    sessionId: sessionIdSchema.parse(d.sessionId),
  }))
  .handler(async ({ data }) => {
    const clientIp = getClientIp();
    await assertRateLimit(`otp-verify:ip:${clientIp}`, {
      capacity: 10,
      refillSeconds: 600,
      label: "verification",
    });

    const sessionIdHash = hashSessionId(data.sessionId);

    const supabaseAdmin = await getAdmin();
    const { data: rows } = await supabaseAdmin
      .from("patient_otp")
      .select("id, code_hash, session_id_hash, expires_at, consumed_at, attempts")
      .eq("phone", data.phone)
      .eq("method", "on_screen")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];

    if (!row) {
      return { ok: false as const, code: "OTP_NOT_FOUND" as const, error: "No active code found. Please request a new one." };
    }
    if (new Date(row.expires_at) < new Date()) {
      return { ok: false as const, code: "OTP_EXPIRED" as const, error: "Your code has expired. Please request a new one." };
    }
    if ((row.attempts ?? 0) >= 5) {
      // Brute-force alert: count recent max-attempts hits from this IP in last 10 min.
      try {
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .eq("action", "otp.max_attempts")
          .gte("created_at", since)
          .contains("metadata", { ip: clientIp });
        if ((count ?? 0) > 3) {
          await supabaseAdmin.from("system_alerts").insert({
            level: "error",
            source: "otp_verifier",
            title: "Possible OTP brute force attempt",
            body: `IP ${clientIp} hit OTP_MAX_ATTEMPTS ${count} times in 10 min.`,
          });
        }
        await supabaseAdmin.from("audit_log").insert({
          action: "otp.max_attempts",
          target_type: "patient_otp",
          target_id: maskPhone(data.phone),
          metadata: { ip: clientIp },
        });
      } catch {
        /* best-effort */
      }
      return { ok: false as const, code: "OTP_MAX_ATTEMPTS" as const, error: "Too many incorrect attempts. Request a new code." };
    }
    if (row.session_id_hash !== sessionIdHash) {
      logger.warn({
        action: "otp_session_mismatch",
        phone_last4: data.phone.slice(-4),
      });
      try {
        await supabaseAdmin.from("system_alerts").insert({
          level: "warning",
          source: "otp_verifier",
          title: "OTP session mismatch detected",
          body: `Phone ****${data.phone.slice(-4)}, IP ${clientIp}.`,
        });
      } catch {
        /* best-effort */
      }
      return { ok: false as const, code: "OTP_SESSION_MISMATCH" as const, error: "Verification failed. Please request a new code." };
    }
    if (row.code_hash !== hashCode(data.code)) {
      await supabaseAdmin
        .from("patient_otp")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id);
      return { ok: false as const, code: "OTP_INVALID" as const, error: "Incorrect code. Please try again." };
    }

    // Success: consume the OTP row, mint a verification token. The token is
    // stored as the row's new code_hash to match createAppointment's lookup
    // (it queries patient_otp by code_hash = verifyToken). Same contract as
    // the SMS path's verifyPatientOtp.
    const verificationToken = randomBytes(24).toString("hex");
    await supabaseAdmin
      .from("patient_otp")
      .update({
        consumed_at: new Date().toISOString(),
        code_hash: verificationToken,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .eq("id", row.id);

    return { ok: true as const, token: verificationToken };
  });

export const requestPatientOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; clinicId?: string }) => ({
    phone: phoneSchema.parse(d.phone),
    clinicId: d.clinicId ? z.string().uuid().parse(d.clinicId) : undefined,
  }))
  .handler(async ({ data }) => {
    const clientIp = getClientIp();
    let blocked = false;
    let blockReason: string | undefined;

    try {
      // 30s cooldown per phone+IP — matches the client-side resend timer and
      // blocks scripted resends that bypass the UI countdown.
      await assertRateLimit(`otp:cooldown:phone:${data.phone}`, { capacity: 1, refillSeconds: 30, label: "verification code (please wait 30s between requests)" });
      await assertRateLimit(`otp:cooldown:ip:${clientIp}`, { capacity: 1, refillSeconds: 30, label: "verification code (please wait 30s between requests)" });
      // Hourly limits: per phone (stops targeting one number) + per IP (stops botnets).
      // DPDP / abuse hardening: keep both layers tight.
      await assertRateLimit(`otp:req:phone:${data.phone}`, { capacity: 3, refillSeconds: 3600, label: "verification code" });
      await assertRateLimit(`otp:req:ip:${clientIp}`, { capacity: 10, refillSeconds: 3600, label: "verification code" });
    } catch (e) {
      blocked = true;
      blockReason = e instanceof Error ? e.message : undefined;
    }

    const supabaseAdmin = await getAdmin();
    // Audit every resend attempt — including rate-limited ones — tied to clinic, phone and IP.
    try {
      await supabaseAdmin.from("audit_log").insert({
        clinic_id: data.clinicId || null,
        action: "otp.resend",
        target_type: "patient_otp",
        // Store only the last 4 digits — never the full phone number in PII.
        target_id: maskPhone(data.phone),
        metadata: {
          ip: clientIp,
          blocked,
          ...(blockReason ? { reason: blockReason } : {}),
        },
      });
    } catch {
      /* best-effort: don't fail the request if audit logging fails */
    }

    if (blocked) {
      throw new Error(blockReason || "Too many requests. Please wait a moment and try again.");
    }

    const code = (100000 + Math.floor(Math.random() * 900000)).toString();
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("patient_otp")
      .insert({
        phone: data.phone,
        code_hash: hashCode(code),
        expires_at: expires,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Dispatch via the configured SMS provider (Super Admin → Settings → SMS Provider).
    // The plaintext code is NEVER returned in the HTTP response — that would
    // let any caller bypass phone verification. Operators using the "dev"
    // provider can retrieve codes from server logs / `sendTestSms` instead.
    const { sendOtpSms } = await import("./sms/provider.server");
    const sent = await sendOtpSms(data.phone, code);

    // On provider failure, roll back the OTP row so the user's attempt
    // window isn't burned by an undelivered code, raise a system alert so
    // MonitoringView surfaces the outage, then return a generic user error.
    if (!sent.ok) {
      await supabaseAdmin.from("patient_otp").delete().eq("id", inserted.id);
      try {
        await supabaseAdmin.from("system_alerts").insert({
          level: "critical",
          source: "sms",
          title: `SMS delivery failed via ${sent.provider}`,
          body: `Phone ${maskPhone(data.phone)} · provider error: ${sent.error}`,
        });
      } catch {
        /* best-effort */
      }
      throw new Error("Could not send verification code. Please try again.");
    }

    // devCode is ONLY returned when BOTH conditions hold:
    //   1. The configured SMS provider is the `dev` adapter (so a real
    //      number was never billed), AND
    //   2. The server is not running in production.
    // In production the dev provider should not be configured; the second
    // gate ensures that even a misconfigured production deploy never leaks
    // a plaintext OTP over HTTP.
    const isDev = sent.provider === "dev" && process.env.NODE_ENV !== "production";
    return {
      ok: true as const,
      devMode: isDev,
      devCode: isDev ? code : undefined,
      providerError: null,
    };
  });


export const verifyPatientOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string }) => ({
    phone: phoneSchema.parse(d.phone),
    code: z.string().regex(/^\d{6}$/).parse(d.code),
  }))
  .handler(async ({ data }) => {
    const clientIp = getClientIp();
    // M4: tighten brute-force protection on the SMS verify path.
    // Phone: 5 attempts / 10 min. IP: 30 / 10 min. Parity with on-screen path.
    await assertRateLimit(`otp:vfy:phone:${data.phone}`, { capacity: 5, refillSeconds: 600, label: "verification" });
    await assertRateLimit(`otp:vfy:ip:${clientIp}`, { capacity: 30, refillSeconds: 600, label: "verification" });
    const supabaseAdmin = await getAdmin();
    const { data: rows } = await supabaseAdmin
      .from("patient_otp")
      .select("id, code_hash, expires_at, consumed_at, attempts")
      .eq("phone", data.phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    // Always return the same generic message for any failure mode so an
    // attacker cannot distinguish "phone not on file" from "wrong code" or
    // "expired" — that signal would otherwise enable phone enumeration and
    // narrow brute-force search.
    const GENERIC = "Invalid or expired code";
    if (!row) return { ok: false, error: GENERIC };
    if (new Date(row.expires_at) < new Date()) return { ok: false, error: GENERIC };
    if (row.attempts >= 5) {
      // M4: audit + alert on max-attempts so MonitoringView surfaces brute force.
      try {
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .eq("action", "otp.max_attempts")
          .gte("created_at", since)
          .contains("metadata", { ip: clientIp });
        if ((count ?? 0) > 3) {
          await supabaseAdmin.from("system_alerts").insert({
            level: "error",
            source: "otp_verifier",
            title: "Possible OTP brute force attempt (SMS path)",
            body: `IP ${clientIp} hit OTP_MAX_ATTEMPTS ${count} times in 10 min.`,
          });
        }
        await supabaseAdmin.from("audit_log").insert({
          action: "otp.max_attempts",
          target_type: "patient_otp",
          target_id: maskPhone(data.phone),
          metadata: { ip: clientIp, path: "sms" },
        });
      } catch {
        /* best-effort */
      }
      return { ok: false, error: GENERIC };
    }
    if (row.code_hash !== hashCode(data.code)) {
      await supabaseAdmin.from("patient_otp").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { ok: false, error: GENERIC };
    }
    const token = randomBytes(24).toString("hex");
    await supabaseAdmin
      .from("patient_otp")
      .update({ consumed_at: new Date().toISOString(), code_hash: token })
      .eq("id", row.id);
    return { ok: true, token };
  });

const createApptInput = z.object({
  clinicId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: z
    .string()
    .datetime({ message: "scheduledAt must be an ISO 8601 datetime" })
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid scheduledAt"),
  patientName: z.string().trim().min(1).max(120),
  patientPhone: phoneSchema,
  patientEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
  verifyToken: z.string().min(20),
  // DPDP Act 2023: explicit consent required before storing patient PII.
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to book an appointment." }),
  }),
});

export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createApptInput.parse(d))
  .handler(async ({ data }) => {
    await assertRateLimit(`book:phone:${data.patientPhone}`, { capacity: 5, refillSeconds: 600, label: "booking" });
    await assertRateLimit(`book:ip:${getClientIp()}`, { capacity: 20, refillSeconds: 600, label: "booking" });
    const supabaseAdmin = await getAdmin();
    // Validate verify token (it replaced code_hash on success)
    const { data: otpRow } = await supabaseAdmin
      .from("patient_otp")
      .select("id, phone, expires_at")
      .eq("code_hash", data.verifyToken)
      .eq("phone", data.patientPhone)
      .maybeSingle();
    if (!otpRow) throw new Error("Verification required");
    if (new Date(otpRow.expires_at).getTime() + 30 * 60_000 < Date.now()) {
      throw new Error("Verification expired");
    }

    // Check clinic active. Use the publishable client + public RLS so any
    // inactive/expired clinic naturally returns null (caller treats as not bookable).
    const sb = await supabasePublic();
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, slug, is_active, expires_at, name, email, address, timezone")
      .eq("id", data.clinicId)
      .maybeSingle();
    if (!clinic || !clinic.is_active) throw new Error("Clinic is not accepting bookings");
    if (clinic.expires_at && new Date(clinic.expires_at) < new Date()) {
      throw new Error("Clinic subscription expired");
    }

    // Resolve doctor interval (per-doctor)
    const { data: docRow } = await sb
      .from("doctors")
      .select("id, appointment_duration_minutes")
      .eq("id", data.doctorId)
      .eq("clinic_id", data.clinicId)
      .maybeSingle();
    if (!docRow) throw new Error("Doctor not found");
    const docDuration = docRow.appointment_duration_minutes ?? 15;

    // Validate scheduledAt: must be in the future, fall inside an active doctor
    // schedule window for that clinic-local weekday, align to the slot interval,
    // and not be covered by a blocking override.
    const scheduledMs = new Date(data.scheduledAt).getTime();
    if (scheduledMs <= Date.now()) {
      throw new Error("Selected time is in the past");
    }

    const { zonedWallTimeToUtc, utcToZonedParts } = await import("./clinic-time");
    const tz = (clinic as { timezone?: string | null }).timezone || "UTC";
    const local = utcToZonedParts(new Date(scheduledMs), tz);

    const { data: daySchedules } = await sb
      .from("doctor_schedules")
      .select("weekday, start_time, end_time, is_active")
      .eq("doctor_id", data.doctorId)
      .eq("is_active", true)
      .eq("weekday", local.weekday);

    const fitsWindow = (daySchedules ?? []).some((s) => {
      const start = (s.start_time as string).slice(0, 5);
      const end = (s.end_time as string).slice(0, 5);
      const windowStartMs = zonedWallTimeToUtc(local.date, start, tz).getTime();
      const windowEndMs = zonedWallTimeToUtc(local.date, end, tz).getTime();
      if (scheduledMs < windowStartMs) return false;
      // Allow the trailing slot: a slot starting exactly at the window end is
      // permitted when the window itself is at least one duration long. This
      // mirrors generateDoctorSlots / getDoctorSlots which surface that slot.
      const isTrailing =
        scheduledMs === windowEndMs &&
        windowEndMs - windowStartMs >= docDuration * 60_000;
      if (!isTrailing && scheduledMs + docDuration * 60_000 > windowEndMs) return false;
      const offsetMin = (scheduledMs - windowStartMs) / 60_000;
      return Number.isInteger(offsetMin) && offsetMin % docDuration === 0;
    });
    if (!fitsWindow) {
      throw new Error("Selected time is outside the doctor's available hours");
    }

    const { data: overrides } = await sb
      .from("doctor_slot_overrides")
      .select("start_time, end_time, is_blocked")
      .eq("doctor_id", data.doctorId)
      .eq("date", local.date);

    const blocked = (overrides ?? []).some((o) => {
      if (!o.is_blocked) return false;
      if (!o.start_time && !o.end_time) return true;
      const blkStart = o.start_time
        ? zonedWallTimeToUtc(local.date, (o.start_time as string).slice(0, 5), tz).getTime()
        : -Infinity;
      const blkEnd = o.end_time
        ? zonedWallTimeToUtc(local.date, (o.end_time as string).slice(0, 5), tz).getTime()
        : Infinity;
      return scheduledMs < blkEnd && scheduledMs + docDuration * 60_000 > blkStart;
    });
    if (blocked) {
      throw new Error("Selected time is unavailable");
    }

    // Check slot still free (appointments are not publicly readable; admin only).
    const { data: conflict } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("doctor_id", data.doctorId)
      .eq("scheduled_at", data.scheduledAt)
      .in("status", ["pending", "confirmed", "rescheduled"])
      .maybeSingle();
    if (conflict) throw new Error("This slot was just booked. Please pick another.");

    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        clinic_id: data.clinicId,
        doctor_id: data.doctorId,
        scheduled_at: data.scheduledAt,
        duration_minutes: docDuration,
        patient_name: data.patientName,
        patient_phone: data.patientPhone,
        patient_email: data.patientEmail || null,
        notes: data.notes || null,
        status: "confirmed",
        consent_at: new Date().toISOString(),
      })
      .select("id, scheduled_at, status")
      .single();
    if (error) {
      // 23P01 = exclusion_violation from the appointments_no_overlap constraint.
      // This is the race-safe fallback when two patients click "Confirm" at once.
      // Never let the raw Postgres message reach the browser.
      if (error.code === "23P01") {
        throw new AppError("This slot is no longer available. Please select another time.", {
          code: error.code,
          cause: error,
        });
      }
      logger.error({
        action: "appointment.create_failed",
        clinic_id: data.clinicId,
        error_code: error.code ?? null,
      });
      throw new AppError("We couldn't book this appointment. Please try again.", {
        code: error.code,
        cause: error,
      });
    }

    // Fire-and-forget patient + clinic emails. The dispatcher dedups by
    // idempotency key so concurrent calls collapse to a single Resend send.
    try {
      const [{ dispatchEmailSafe }, { utcToZonedParts: tz2 }] = await Promise.all([
        import("./notifications/email-dispatcher.server"),
        import("./clinic-time"),
      ]);
      const { data: doctorRow } = await supabaseAdmin
        .from("doctors")
        .select("name")
        .eq("id", data.doctorId)
        .maybeSingle();
      const local2 = tz2(new Date(appt.scheduled_at), (clinic as { timezone?: string | null }).timezone || "UTC");
      const apptDate = local2.date;
      const apptTime = (() => {
        const d = new Date(appt.scheduled_at);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: (clinic as { timezone?: string | null }).timezone || "UTC" });
      })();
      const clinicName = (clinic as { name?: string }).name ?? "the clinic";
      const clinicAddress = ((clinic as { address?: string | null }).address ?? "").toString();
      const clinicPhone = "";
      const doctorName = doctorRow?.name ?? "your doctor";

      if (data.patientEmail) {
        dispatchEmailSafe({
          event: "appointment_booked_patient",
          to: data.patientEmail,
          idempotencyKey: `appt_booked_patient:${appt.id}`,
          clinicId: data.clinicId,
          props: {
            patientName: data.patientName,
            clinicName,
            doctorName,
            appointmentDate: apptDate,
            appointmentTime: apptTime,
            clinicAddress,
            clinicPhone,
          },
        });
      }
      const clinicEmail = (clinic as { email?: string | null }).email;
      if (clinicEmail) {
        const { maskPhone } = await import("./notifications/mask");
        dispatchEmailSafe({
          event: "appointment_booked_clinic",
          to: clinicEmail,
          idempotencyKey: `appt_booked_clinic:${appt.id}`,
          clinicId: data.clinicId,
          props: {
            clinicName,
            patientName: data.patientName,
            patientPhone: maskPhone(data.patientPhone),
            doctorName,
            appointmentDate: apptDate,
            appointmentTime: apptTime,
            managerPortalUrl: `${process.env.APP_URL ?? ""}/${(clinic as { slug?: string }).slug ?? ""}/clinicmanager`,
          },
        });
      }
    } catch (err) {
      logger.error({ action: "appointment.email_dispatch_failed", appointment_id: appt.id, error: err instanceof Error ? err.message : String(err) });
    }

    return { ok: true, appointmentId: appt.id, scheduledAt: appt.scheduled_at };
  });
