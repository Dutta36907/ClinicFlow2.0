import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext, assertClinicAccess } from "@/lib/server/auth-context";

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

// --- Access helpers -------------------------------------------------------

async function resolveClinicBySlug(slug: string) {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select(
      "id, slug, name, phone, email, whatsapp, website, address, google_map_url, description, tagline, logo_url, timezone, working_hours, appointment_duration_minutes, is_active, expires_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/);

// --- Dashboard bootstrap --------------------------------------------------

export const getManagerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: slugSchema.parse(d.slug.toLowerCase()) }))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const clinic = await resolveClinicBySlug(data.slug);
    if (!clinic) return null;

    const ctx = await getAuthContext(context.userId);
    const isSuper = ctx.isSuper && !ctx.isDisabled;
    const isManager = ctx.managedClinicIds.includes(clinic.id);
    if (!isSuper && !isManager) return { unauthorized: true as const };

    // Bounded fetch: dashboard exposes the full doctor list to other
    // sections (filters, reschedule dialog). 200 is a defensive ceiling.
    const { data: doctors } = await supabaseAdmin
      .from("doctors")
      .select(
        "id, name, specialization, degree, years_experience, description, photo_url, is_active, appointment_duration_minutes, specialties, languages",
      )
      .eq("clinic_id", clinic.id)
      .order("name")
      .range(0, 199);

    return {
      clinic,
      doctors: doctors ?? [],
      role: isSuper ? ("super_admin" as const) : ("clinic_manager" as const),
    };
  });

// --- Profile --------------------------------------------------------------

const profileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().url().max(500).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  google_map_url: z.string().trim().url().max(1000).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  logo_url: z.string().trim().url().max(1000).optional().or(z.literal("")),
});

export const updateClinicProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.id);
    const { stripTags } = await import("@/lib/validation/strip-tags");
    // Defense-in-depth: scrub HTML/script from every free-text field
    // before it reaches storage. We never render these as HTML, but a
    // stored payload could still be copy-pasted into a context that does.
    const { error } = await supabaseAdmin
      .from("clinics")
      .update({
        name: stripTags(data.name) || data.name,
        phone: data.phone || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        website: data.website || null,
        address: stripTags(data.address) || null,
        google_map_url: data.google_map_url || null,
        description: stripTags(data.description) || null,
        tagline: stripTags(data.tagline) || null,
        logo_url: data.logo_url || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Working hours --------------------------------------------------------

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayValueSchema = z.tuple([z.string().regex(timeRe), z.string().regex(timeRe)]).nullable();

const workingHoursSchema = z.object({
  id: z.string().uuid(),
  working_hours: z.object({
    mon: dayValueSchema,
    tue: dayValueSchema,
    wed: dayValueSchema,
    thu: dayValueSchema,
    fri: dayValueSchema,
    sat: dayValueSchema,
    sun: dayValueSchema,
  }),
});

export const updateClinicWorkingHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => workingHoursSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.id);
    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: data.working_hours })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Doctors --------------------------------------------------------------

const tagArray = z.array(z.string().trim().min(1).max(60)).max(12).optional();

const doctorSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  specialization: z.string().trim().max(120).optional().or(z.literal("")),
  degree: z.string().trim().max(120).optional().or(z.literal("")),
  years_experience: z.number().int().min(0).max(80).nullable().optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  photo_url: z.string().trim().url().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
  specialties: tagArray,
  languages: tagArray,
});

export const upsertDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => doctorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const row = {
      clinic_id: data.clinic_id,
      name: data.name,
      specialization: data.specialization || null,
      degree: data.degree || null,
      years_experience: data.years_experience ?? null,
      description: data.description || null,
      photo_url: data.photo_url || null,
      is_active: data.is_active,
      specialties: data.specialties && data.specialties.length > 0 ? data.specialties : null,
      languages: data.languages && data.languages.length > 0 ? data.languages : null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("doctors")
        .update(row)
        .eq("id", data.id)
        .eq("clinic_id", data.clinic_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("doctors")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), clinic_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("doctors")
      .delete()
      .eq("id", data.id)
      .eq("clinic_id", data.clinic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const intervalSchema = z.object({
  clinic_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  appointment_duration_minutes: z.number().int().min(5).max(240),
});

export const updateDoctorInterval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => intervalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("doctors")
      .update({ appointment_duration_minutes: data.appointment_duration_minutes })
      .eq("id", data.doctor_id)
      .eq("clinic_id", data.clinic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Team / RBAC ----------------------------------------------------------

const listMembersSchema = z.object({
  clinic_id: z.string().uuid(),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const listClinicMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listMembersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      count,
      error,
    } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role", { count: "exact" })
      .eq("clinic_id", data.clinic_id)
      .range(from, to);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    const profileMap = new Map<string, string | null>();
    const emailMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const [{ data: profs }, { data: emails }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
        supabaseAdmin.rpc("get_emails_for_ids", { _ids: userIds }),
      ]);
      (profs ?? []).forEach((p) =>
        profileMap.set(p.id as string, (p.full_name as string | null) ?? null),
      );
      ((emails ?? []) as Array<{ id: string; email: string | null }>).forEach((e) =>
        emailMap.set(e.id, e.email ?? null),
      );
    }
    const members = (rows ?? []).map((r) => ({
      role_id: r.id as string,
      user_id: r.user_id as string,
      role: r.role as "clinic_manager" | "clinic_user",
      email: emailMap.get(r.user_id as string) ?? null,
      full_name: profileMap.get(r.user_id as string) ?? null,
    }));
    return { rows: members, total: count ?? 0 };
  });

const addUserSchema = z.object({
  clinic_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

export const addClinicUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const email = data.email.trim().toLowerCase();

    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (created.error) {
      const msg = created.error.message?.toLowerCase() ?? "";
      const exists =
        msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!exists) throw new Error(created.error.message);
      const { data: foundId, error: lookupErr } = await supabaseAdmin.rpc("get_user_id_by_email", {
        _email: email,
      });
      if (lookupErr) throw new Error(lookupErr.message);
      userId = (foundId as string | null) ?? null;
      if (!userId) throw new Error("User exists but could not be resolved");
    } else {
      userId = created.data.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to resolve user id");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.full_name }, { onConflict: "id" });

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      clinic_id: data.clinic_id,
      role: "clinic_user",
    });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
      throw new Error(roleErr.message);
    }
    return { user_id: userId };
  });

export const removeClinicUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clinic_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("clinic_id", data.clinic_id)
      .eq("user_id", data.user_id)
      .eq("role", "clinic_user");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Appointment lifecycle (reschedule / cancel) --------------------------
// Both mutate appointments and fire transactional emails through the central
// dispatcher. Dedup keys include the new scheduled_at / a cancel marker so
// repeated calls on the same record collapse to a single Resend send.

const rescheduleSchema = z.object({
  appointmentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rescheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const { data: appt, error: getErr } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, clinic_id, doctor_id, scheduled_at, patient_name, patient_email, patient_phone, status",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!appt) throw new Error("Appointment not found");
    await assertClinicAccess(context.userId, appt.clinic_id);
    if (appt.status === "cancelled") throw new Error("Cannot reschedule a cancelled appointment");

    const oldScheduledAt = appt.scheduled_at;
    if (new Date(data.scheduledAt).toISOString() === new Date(oldScheduledAt).toISOString()) {
      // No-op: same time. Don't update, don't email — avoids accidental
      // duplicate notifications from a misclick.
      return { ok: true, unchanged: true };
    }

    const { error: updErr } = await supabaseAdmin
      .from("appointments")
      .update({
        scheduled_at: data.scheduledAt,
        status: "rescheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.appointmentId);
    if (updErr) {
      if (updErr.code === "23P01") throw new Error("That slot conflicts with another appointment.");
      throw new Error(updErr.message);
    }

    // Email the patient. Dedup by appointment + new scheduled_at so a
    // rapid double-click doesn't fire twice.
    if (appt.patient_email) {
      const [{ dispatchEmailSafe }, { utcToZonedParts }] = await Promise.all([
        import("./notifications/email-dispatcher.server"),
        import("./clinic-time"),
      ]);
      const { data: clinic } = await supabaseAdmin
        .from("clinics")
        .select("name, address, phone, timezone")
        .eq("id", appt.clinic_id)
        .maybeSingle();
      const { data: doctor } = await supabaseAdmin
        .from("doctors")
        .select("name")
        .eq("id", appt.doctor_id)
        .maybeSingle();
      const tz = clinic?.timezone || "UTC";
      const fmtDate = (iso: string) => utcToZonedParts(new Date(iso), tz).date;
      const fmtTime = (iso: string) =>
        new Date(iso).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        });

      dispatchEmailSafe({
        event: "appointment_rescheduled",
        to: appt.patient_email,
        idempotencyKey: `appt_rescheduled:${appt.id}:${new Date(data.scheduledAt).toISOString()}`,
        clinicId: appt.clinic_id,
        props: {
          patientName: appt.patient_name,
          clinicName: clinic?.name ?? "your clinic",
          doctorName: doctor?.name ?? "your doctor",
          oldDate: fmtDate(oldScheduledAt),
          oldTime: fmtTime(oldScheduledAt),
          appointmentDate: fmtDate(data.scheduledAt),
          appointmentTime: fmtTime(data.scheduledAt),
          clinicAddress: clinic?.address ?? "",
          clinicPhone: clinic?.phone ?? "",
        },
      });
    }

    return { ok: true, unchanged: false };
  });

const cancelSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const { data: appt, error: getErr } = await supabaseAdmin
      .from("appointments")
      .select("id, clinic_id, doctor_id, scheduled_at, patient_name, patient_email, status")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!appt) throw new Error("Appointment not found");
    await assertClinicAccess(context.userId, appt.clinic_id);
    if (appt.status === "cancelled") return { ok: true, alreadyCancelled: true };

    const { error: updErr } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.appointmentId);
    if (updErr) throw new Error(updErr.message);

    if (appt.patient_email) {
      const [{ dispatchEmailSafe }, { utcToZonedParts }] = await Promise.all([
        import("./notifications/email-dispatcher.server"),
        import("./clinic-time"),
      ]);
      const { data: clinic } = await supabaseAdmin
        .from("clinics")
        .select("name, phone, timezone")
        .eq("id", appt.clinic_id)
        .maybeSingle();
      const { data: doctor } = await supabaseAdmin
        .from("doctors")
        .select("name")
        .eq("id", appt.doctor_id)
        .maybeSingle();
      const tz = clinic?.timezone || "UTC";

      dispatchEmailSafe({
        event: "appointment_cancelled",
        to: appt.patient_email,
        idempotencyKey: `appt_cancelled:${appt.id}`,
        clinicId: appt.clinic_id,
        props: {
          patientName: appt.patient_name,
          clinicName: clinic?.name ?? "your clinic",
          doctorName: doctor?.name ?? "your doctor",
          appointmentDate: utcToZonedParts(new Date(appt.scheduled_at), tz).date,
          appointmentTime: new Date(appt.scheduled_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: tz,
          }),
          clinicPhone: clinic?.phone ?? "",
          reason: data.reason,
        },
      });
    }

    return { ok: true, alreadyCancelled: false };
  });
