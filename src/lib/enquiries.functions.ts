// Server functions for landing-page enquiries.
// - createEnquiry: public, validated, lightly rate-limited (by IP).
// - listEnquiries / updateEnquiryStatus: super-admin only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { ENQUIRY_STATUSES, ENQUIRY_TYPES, type Enquiry } from "@/types/enquiry.types";

async function getAdmin() {
  const supabaseAdmin = await getAdmin();
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(20),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  enquiry_type: z.enum(ENQUIRY_TYPES),
});

export const createEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    // Tight per-IP rate limit (3 / hour) to deter spam — clinics shouldn't
    // see hundreds of fake enquiries flood the lead pipeline.
    await assertRateLimit(`enquiry:${getClientIp()}`, {
      capacity: 3,
      refillSeconds: 3600,
      label: "enquiry",
    });

    const { error } = await supabaseAdmin.from("enquiries").insert({
      full_name: data.full_name,
      company_name: data.company_name || null,
      email: data.email,
      phone: data.phone,
      message: data.message || null,
      enquiry_type: data.enquiry_type,
      status: "new",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

async function assertSuperAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  // Single RPC round-trip replaces two serial queries (user_roles + super_admin_permissions).
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data)
    ? data[0]
    : (data as { is_super?: boolean; is_disabled?: boolean } | null);
  if (!row?.is_super) throw new Error("Not authorized");
  if (row.is_disabled) throw new Error("Your account is disabled");
}

const listEnquiriesSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })
  .default({ page: 1, pageSize: 25 });

export const listEnquiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listEnquiriesSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ rows: Enquiry[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: rows,
      error,
      count,
    } = await supabaseAdmin
      .from("enquiries")
      .select(
        "id, full_name, company_name, email, phone, message, enquiry_type, status, created_at, updated_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as Enquiry[], total: count ?? 0 };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ENQUIRY_STATUSES),
});

export const updateEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("enquiries")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Hard delete — DPDP Act 2023 deletion requests must remove the row entirely.
// Gated to super admins with the `can_enquiries` permission.
const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { data: perm } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("can_enquiries")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!perm?.can_enquiries) throw new Error("Not authorized to delete enquiries");
    const { error } = await supabaseAdmin.from("enquiries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
