// Central email dispatcher. The ONE place that:
//   1. Loads platform_settings.email (master switch, per-event toggles, Resend creds).
//   2. Computes a stable idempotency key and deduplicates against
//      `email_send_log` (status='sent' wins, status='pending' blocks concurrent
//      duplicates).
//   3. Renders the React Email template and calls Resend.
//   4. Records the final outcome in `email_send_log`.
//
// All call sites should use this — never call sendResendEmail directly.
// Fire-and-forget at call sites: a Resend outage must never block user flow.

import type { ReactElement } from "react";
import * as React from "react";
import { sendResendEmail } from "./providers/resend.server";
import {
  AccountSuspendedEmail,
  type AccountSuspendedEmailProps,
  AppointmentBookedEmail,
  type AppointmentBookedEmailProps,
  AppointmentCancelledEmail,
  type AppointmentCancelledEmailProps,
  AppointmentRescheduledEmail,
  type AppointmentRescheduledEmailProps,
  ClinicManagerInviteEmail,
  type ClinicManagerInviteEmailProps,
  ClinicNewBookingEmail,
  type ClinicNewBookingEmailProps,
  NewClinicWelcomeEmail,
  type NewClinicWelcomeEmailProps,
  SubscriptionExpiryEmail,
  type SubscriptionExpiryEmailProps,
} from "./templates/email";

// ---------------------------------------------------------------------------
// Settings shape — mirrors what's stored in platform_settings.email JSONB.
// ---------------------------------------------------------------------------

export interface EmailSettings {
  enabled: boolean;
  resendApiKey?: string;
  fromAddress?: string;
  fromName?: string;
  events: {
    clinic_welcome: boolean;
    clinic_manager_invite: boolean;
    subscription_expiry: boolean;
    account_suspended: boolean;
    appointment_booked_patient: boolean;
    appointment_booked_clinic: boolean;
    appointment_rescheduled: boolean;
    appointment_cancelled: boolean;
  };
  expiryReminderDays: number[]; // e.g. [7, 3, 1]
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  events: {
    clinic_welcome: true,
    clinic_manager_invite: true,
    subscription_expiry: true,
    account_suspended: true,
    appointment_booked_patient: true,
    appointment_booked_clinic: true,
    appointment_rescheduled: true,
    appointment_cancelled: true,
  },
  expiryReminderDays: [7, 3, 1],
};

export type EmailEventKey = keyof EmailSettings["events"];

// ---------------------------------------------------------------------------
// Discriminated union of dispatch payloads — one shape per template.
// ---------------------------------------------------------------------------

export type DispatchPayload =
  | {
      event: "clinic_welcome";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: NewClinicWelcomeEmailProps;
    }
  | {
      event: "clinic_manager_invite";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: ClinicManagerInviteEmailProps;
    }
  | {
      event: "subscription_expiry";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: SubscriptionExpiryEmailProps;
    }
  | {
      event: "account_suspended";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: AccountSuspendedEmailProps;
    }
  | {
      event: "appointment_booked_patient";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: AppointmentBookedEmailProps;
    }
  | {
      event: "appointment_booked_clinic";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: ClinicNewBookingEmailProps;
    }
  | {
      event: "appointment_rescheduled";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: AppointmentRescheduledEmailProps;
    }
  | {
      event: "appointment_cancelled";
      to: string;
      idempotencyKey: string;
      clinicId?: string;
      props: AppointmentCancelledEmailProps;
    };

interface RenderedTemplate {
  subject: string;
  element: ReactElement;
}

function render(payload: DispatchPayload): RenderedTemplate {
  switch (payload.event) {
    case "clinic_welcome":
      return {
        subject: `Welcome to ClinicFlow, ${payload.props.clinicName}!`,
        element: React.createElement(NewClinicWelcomeEmail, payload.props),
      };
    case "clinic_manager_invite":
      return {
        subject: `You're invited to manage ${payload.props.clinicName}`,
        element: React.createElement(ClinicManagerInviteEmail, payload.props),
      };
    case "subscription_expiry":
      return {
        subject: `Your ClinicFlow subscription expires in ${payload.props.daysRemaining} days`,
        element: React.createElement(SubscriptionExpiryEmail, payload.props),
      };
    case "account_suspended":
      return {
        subject: `Your ${payload.props.clinicName} account has been suspended`,
        element: React.createElement(AccountSuspendedEmail, payload.props),
      };
    case "appointment_booked_patient":
      return {
        subject: `Your appointment at ${payload.props.clinicName} is confirmed`,
        element: React.createElement(AppointmentBookedEmail, payload.props),
      };
    case "appointment_booked_clinic":
      return {
        subject: `New booking: ${payload.props.patientName}`,
        element: React.createElement(ClinicNewBookingEmail, payload.props),
      };
    case "appointment_rescheduled":
      return {
        subject: `Your appointment at ${payload.props.clinicName} has been rescheduled`,
        element: React.createElement(AppointmentRescheduledEmail, payload.props),
      };
    case "appointment_cancelled":
      return {
        subject: `Your appointment at ${payload.props.clinicName} has been cancelled`,
        element: React.createElement(AppointmentCancelledEmail, payload.props),
      };
  }
}

// ---------------------------------------------------------------------------
// Settings loader. Reads platform_settings.email, merges with defaults, and
// returns a fully-populated settings object. Cached per-request would be
// nice; we re-read each dispatch because dispatches are rare and a tiny
// SELECT is cheap compared with a Resend HTTP call.
// ---------------------------------------------------------------------------

export async function loadEmailSettings(): Promise<EmailSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("email")
    .limit(1)
    .maybeSingle();
  const raw = (data?.email ?? {}) as Partial<EmailSettings>;
  return {
    enabled: raw.enabled ?? DEFAULT_EMAIL_SETTINGS.enabled,
    resendApiKey: raw.resendApiKey,
    fromAddress: raw.fromAddress,
    fromName: raw.fromName,
    events: { ...DEFAULT_EMAIL_SETTINGS.events, ...(raw.events ?? {}) },
    expiryReminderDays:
      Array.isArray(raw.expiryReminderDays) && raw.expiryReminderDays.length > 0
        ? raw.expiryReminderDays
        : DEFAULT_EMAIL_SETTINGS.expiryReminderDays,
  };
}

// ---------------------------------------------------------------------------
// Dispatch result. Never throws — callers can fire-and-forget.
// ---------------------------------------------------------------------------

export type DispatchResult =
  | { status: "sent"; messageId?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Send (or dedupe/skip) one transactional email. Idempotency is enforced by
 * the UNIQUE constraint on email_send_log.idempotency_key: we always insert
 * a 'pending' row first; a duplicate key insert returns gracefully and we
 * skip the send. On success the row is updated to 'sent'; on failure to
 * 'failed' (which leaves the key occupied so retries don't blast Resend —
 * the operator can re-enable manually by deleting the row if needed).
 */
export async function dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settings = await loadEmailSettings();

  // --- Toggle checks ------------------------------------------------------
  if (!settings.enabled) return { status: "skipped", reason: "email_disabled" };
  if (!settings.events[payload.event]) {
    return { status: "skipped", reason: `event_disabled:${payload.event}` };
  }
  if (!settings.resendApiKey) {
    return { status: "skipped", reason: "no_api_key" };
  }
  if (!settings.fromAddress) {
    return { status: "skipped", reason: "no_from_address" };
  }
  if (!payload.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to)) {
    return { status: "skipped", reason: "invalid_recipient" };
  }

  // --- Dedup via insert. UNIQUE constraint blocks duplicates atomically. --
  const { data: pendingRow, error: insertErr } = await supabaseAdmin
    .from("email_send_log")
    .insert({
      idempotency_key: payload.idempotencyKey,
      event_type: payload.event,
      recipient_email: payload.to,
      clinic_id: payload.clinicId ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    // 23505 = unique_violation = we've already attempted this idempotency_key.
    if (insertErr.code === "23505") {
      return { status: "skipped", reason: "already_dispatched" };
    }
    return { status: "failed", error: insertErr.message };
  }
  const rowId = pendingRow?.id;

  // --- Render + send ------------------------------------------------------
  const { subject, element } = render(payload);
  const result = await sendResendEmail({
    apiKey: settings.resendApiKey,
    from: settings.fromAddress,
    fromName: settings.fromName ?? "",
    to: payload.to,
    subject,
    reactTemplate: element,
  });

  // --- Record outcome -----------------------------------------------------
  if (rowId) {
    if (result.success) {
      await supabaseAdmin
        .from("email_send_log")
        .update({
          status: "sent",
          provider_message_id: result.msgId ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    } else {
      await supabaseAdmin
        .from("email_send_log")
        .update({
          status: "failed",
          error: result.error ?? "unknown",
        })
        .eq("id", rowId);
    }
  }

  return result.success
    ? { status: "sent", messageId: result.msgId }
    : { status: "failed", error: result.error ?? "unknown" };
}

/**
 * Convenience wrapper for fire-and-forget call sites. Swallows everything
 * and never rejects — booking flow must never break because Resend is down.
 */
export function dispatchEmailSafe(payload: DispatchPayload): void {
  void dispatchEmail(payload).catch((err) => {
    console.error("[email] dispatch crashed", payload.event, err);
  });
}
