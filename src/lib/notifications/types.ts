// Shared types for the notification module.
// Server-safe (no React imports here).

export type NotificationChannel = "sms" | "whatsapp" | "email";

export type NotificationEvent =
  | "appointment_booked"
  | "appointment_rescheduled"
  | "clinic_new_booking"
  | "new_clinic_welcome"
  | "subscription_expiry";

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  "appointment_booked",
  "appointment_rescheduled",
  "clinic_new_booking",
  "new_clinic_welcome",
  "subscription_expiry",
];

export type SkipReason =
  | "master_disabled"
  | "event_disabled"
  | "channel_disabled"
  | "clinic_preference"
  | "no_credentials"
  | "no_recipient";

export interface SmsBlock {
  is_enabled: boolean;
  provider: "msg91" | string;
  msg91_auth_key: string;
  msg91_sender_id: string;
  msg91_template_ids: Record<string, string>;
  // legacy compat
  authKey?: string;
  senderId?: string;
  templateId?: string;
  enabled?: boolean;
}

export interface WhatsappBlock {
  is_enabled: boolean;
  provider: "interakt" | string;
  interakt_api_key: string;
  interakt_base_url: string;
  template_ids: Record<string, string>;
}

export interface EmailBlock {
  is_enabled: boolean;
  provider: "resend" | string;
  resend_api_key: string;
  from_address: string;
  from_name: string;
}

export interface NotificationsBlock {
  master_enabled: boolean;
  events: Record<NotificationEvent, { is_enabled: boolean }>;
}

export interface PlatformNotificationSettings {
  notifications: NotificationsBlock;
  sms: SmsBlock;
  whatsapp: WhatsappBlock;
  email: EmailBlock;
}

export interface DispatchResult {
  channel: NotificationChannel | "all";
  status: "sent" | "failed" | "skipped";
  skip_reason?: SkipReason;
  provider_msg_id?: string;
  error_message?: string;
}
