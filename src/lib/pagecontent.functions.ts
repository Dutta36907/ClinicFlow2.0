/**
 * Page content server functions — cover image, performance stats,
 * treatments, testimonials, gallery. All manager-protected.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}


async function assertClinicAccess(userId: string, clinicId: string) {
  const supabaseAdmin = await getAdmin();
  // Single RPC round-trip — returns is_super, is_disabled, and clinic_ids.
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : (data as { is_super?: boolean; is_disabled?: boolean; clinic_ids?: string[] } | null);
  if (row?.is_super) {
    if (row.is_disabled) throw new Error("Your account is disabled");
    return;
  }
  if (!(row?.clinic_ids ?? []).includes(clinicId)) throw new Error("Not authorized");
}

// ── Cover image ─────────────────────────────────────────────────
export const updateClinicCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        cover_image_url: z.string().trim().url().max(1000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.id);
    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ cover_image_url: data.cover_image_url })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Performance stats ───────────────────────────────────────────
const statSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(20),
});

export const updateClinicStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        performance_stats: z.array(statSchema).min(0).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.id);
    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ performance_stats: data.performance_stats })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Treatments ──────────────────────────────────────────────────
const treatmentSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  display_order: z.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(true),
});

const listPageSchema = z.object({
  clinic_id: z.string().uuid(),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const listTreatments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listPageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await supabaseAdmin
      .from("clinic_treatments")
      .select("id, title, description, icon, display_order, is_active", { count: "exact" })
      .eq("clinic_id", data.clinic_id)
      .order("display_order")
      .order("created_at")
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });




export const upsertTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => treatmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const row = {
      clinic_id: data.clinic_id,
      title: data.title,
      description: data.description || null,
      icon: data.icon || null,
      display_order: data.display_order,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("clinic_treatments")
        .update(row)
        .eq("id", data.id)
        .eq("clinic_id", data.clinic_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("clinic_treatments")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), clinic_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("clinic_treatments")
      .delete()
      .eq("id", data.id)
      .eq("clinic_id", data.clinic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Testimonials ────────────────────────────────────────────────
const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  clinic_id: z.string().uuid(),
  patient_name: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  quote: z.string().trim().min(1).max(1000),
  photo_url: z.string().trim().url().max(1000).optional().or(z.literal("")),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  display_order: z.number().int().min(0).max(999).default(0),
  is_featured: z.boolean().default(false),
});

export const listTestimonials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listPageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await supabaseAdmin
      .from("clinic_testimonials")
      .select(
        "id, patient_name, rating, quote, photo_url, review_date, display_order, is_featured",
        { count: "exact" },
      )
      .eq("clinic_id", data.clinic_id)
      .order("display_order")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });



export const upsertTestimonial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testimonialSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const row = {
      clinic_id: data.clinic_id,
      patient_name: data.patient_name,
      rating: data.rating,
      quote: data.quote,
      photo_url: data.photo_url || null,
      review_date: data.review_date || null,
      display_order: data.display_order,
      is_featured: data.is_featured,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("clinic_testimonials")
        .update(row)
        .eq("id", data.id)
        .eq("clinic_id", data.clinic_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("clinic_testimonials")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), clinic_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("clinic_testimonials")
      .delete()
      .eq("id", data.id)
      .eq("clinic_id", data.clinic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Gallery ─────────────────────────────────────────────────────
const galleryAddSchema = z.object({
  clinic_id: z.string().uuid(),
  image_url: z.string().trim().url().max(1000),
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  display_order: z.number().int().min(0).max(9999).default(0),
});

export const listGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listPageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await supabaseAdmin
      .from("clinic_gallery")
      .select("id, image_url, caption, display_order", { count: "exact" })
      .eq("clinic_id", data.clinic_id)
      .order("display_order")
      .order("created_at")
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });



export const addGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => galleryAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { data: ins, error } = await supabaseAdmin
      .from("clinic_gallery")
      .insert({
        clinic_id: data.clinic_id,
        image_url: data.image_url,
        caption: data.caption || null,
        display_order: data.display_order,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteGalleryImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), clinic_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const { error } = await supabaseAdmin
      .from("clinic_gallery")
      .delete()
      .eq("id", data.id)
      .eq("clinic_id", data.clinic_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
