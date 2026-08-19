// Super-admin server functions for managing platform email settings.
// Mirrors the SMS settings flow: read masks the API key, write merges with
// existing (empty string = "leave as-is"), and `sendTestEmail` lets the
// operator validate the Resend pipeline end-to-end.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

async function assertSuperAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not authorized");
  const { data: perm } = await supabaseAdmin
    .from("super_admin_permissions")
    .select("is_disabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (perm?.is_disabled) throw new Error("Your account is disabled");
}

const eventTogglesSchema = z.object({
  clinic_welcome: z.boolean(),
  clinic_manager_invite: z.boolean(),
  subscription_expiry: z.boolean(),
  account_suspended: z.boolean(),
  appointment_booked_patient: z.boolean(),
  appointment_booked_clinic: z.boolean(),
  appointment_rescheduled: z.boolean(),
  appointment_cancelled: z.boolean(),
});

const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  // Empty string from the client = "keep existing secret".
  resendApiKey: z.string().trim().max(200).optional().or(z.literal("")),
  fromAddress: z.string().trim().max(255).optional().or(z.literal("")),
  fromName: z.string().trim().max(120).optional().or(z.literal("")),
  events: eventTogglesSchema,
  expiryReminderDays: z.array(z.number().int().min(1).max(90)).max(8),
});

function maskKey(v: string | undefined): string {
  if (!v) return "";
  return v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
}

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("email, updated_at")
      .limit(1)
      .maybeSingle();
    const raw = (data?.email ?? {}) as Partial<z.infer<typeof emailSettingsSchema>> & {
      resendApiKey?: string;
    };
    return {
      settings: {
        enabled: raw.enabled ?? false,
        resendApiKey: maskKey(raw.resendApiKey),
        hasApiKey: Boolean(raw.resendApiKey),
        fromAddress: raw.fromAddress ?? "",
        fromName: raw.fromName ?? "",
        events: {
          clinic_welcome: raw.events?.clinic_welcome ?? true,
          clinic_manager_invite: raw.events?.clinic_manager_invite ?? true,
          subscription_expiry: raw.events?.subscription_expiry ?? true,
          account_suspended: raw.events?.account_suspended ?? true,
          appointment_booked_patient: raw.events?.appointment_booked_patient ?? true,
          appointment_booked_clinic: raw.events?.appointment_booked_clinic ?? true,
          appointment_rescheduled: raw.events?.appointment_rescheduled ?? true,
          appointment_cancelled: raw.events?.appointment_cancelled ?? true,
        },
        expiryReminderDays:
          Array.isArray(raw.expiryReminderDays) && raw.expiryReminderDays.length > 0
            ? raw.expiryReminderDays
            : [7, 3, 1],
      },
      updatedAt: data?.updated_at ?? null,
    };
  });

export const updateEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: existingRow } = await supabaseAdmin
      .from("platform_settings")
      .select("id, email")
      .limit(1)
      .maybeSingle();
    const existing = (existingRow?.email ?? {}) as Record<string, unknown>;

    // Empty secret/text means "leave as-is" — same convention as SMS settings.
    const pickSecret = (next: string | undefined, prev: unknown) =>
      next && next.length > 0 ? next : ((prev as string | undefined) ?? undefined);

    const nextEmail = {
      enabled: data.enabled,
      resendApiKey: pickSecret(data.resendApiKey, existing.resendApiKey),
      fromAddress: pickSecret(data.fromAddress, existing.fromAddress),
      fromName: pickSecret(data.fromName, existing.fromName) ?? "",
      events: data.events,
      expiryReminderDays: data.expiryReminderDays,
    };

    if (existingRow?.id) {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .update({
          email: nextEmail,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRow.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .insert({ email: nextEmail, updated_by: context.userId });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "email_settings.update",
      target_type: "platform_settings",
      metadata: { enabled: data.enabled, events: data.events },
    });

    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ to: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    // Use a unique idempotency key per test send so operators can resend.
    const { dispatchEmail } = await import("./notifications/email-dispatcher.server");
    const result = await dispatchEmail({
      event: "clinic_welcome",
      to: data.to,
      idempotencyKey: `test:${context.userId}:${Date.now()}`,
      props: {
        managerName: "Operator",
        clinicName: "Test Clinic",
        clinicSlug: "test-clinic",
        loginUrl: "https://example.com/login",
      },
    });

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "email_settings.test",
      target_type: "platform_settings",
      metadata: { status: result.status },
    });

    if (result.status === "sent") {
      return { ok: true as const, messageId: result.messageId };
    }
    if (result.status === "skipped") {
      return { ok: false as const, error: `Skipped: ${result.reason}` };
    }
    return { ok: false as const, error: result.error };
  });
