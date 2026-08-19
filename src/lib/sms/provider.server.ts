// Server-only SMS dispatcher. Reads provider config from
// `platform_settings.sms` (super-admin gated) and routes to the matching
// adapter. The "dev" adapter is the default and simply logs; replace by
// configuring a real provider via the Super Admin → Settings → SMS Provider UI.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendDev } from "./adapters/dev";
import { sendTwilio } from "./adapters/twilio";
import { sendMsg91 } from "./adapters/msg91";
import { sendGupshup } from "./adapters/gupshup";

export type SmsProviderId = "dev" | "twilio" | "msg91" | "gupshup" | "on_screen";

export type SmsSettings = {
  provider: SmsProviderId;
  enabled: boolean;
  twilio?: { accountSid?: string; authToken?: string; fromNumber?: string };
  msg91?: { authKey?: string; senderId?: string; templateId?: string };
  gupshup?: { apiKey?: string; source?: string; appName?: string };
};

export type SmsResult =
  | { ok: true; provider: SmsProviderId; messageId?: string; dev?: boolean }
  | { ok: false; provider: SmsProviderId; error: string };

const DEFAULT_SETTINGS: SmsSettings = { provider: "dev", enabled: true };

export async function loadSmsSettings(): Promise<SmsSettings> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("sms")
    .limit(1)
    .maybeSingle();
  const raw = (data?.sms ?? {}) as Partial<SmsSettings>;
  return {
    provider: (raw.provider as SmsProviderId) || DEFAULT_SETTINGS.provider,
    enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
    twilio: raw.twilio,
    msg91: raw.msg91,
    gupshup: raw.gupshup,
  };
}

/**
 * Sends an OTP via the currently configured provider.
 * The caller passes the already-generated 6-digit code; this module never
 * persists or logs the plaintext outside of the dev adapter.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const settings = await loadSmsSettings();
  if (!settings.enabled) {
    return { ok: false, provider: settings.provider, error: "SMS provider is disabled" };
  }
  const message = `Your verification code is ${code}. It expires in 10 minutes.`;
  try {
    switch (settings.provider) {
      case "twilio":
        return await sendTwilio(phone, message, settings.twilio ?? {});
      case "msg91":
        return await sendMsg91(phone, code, settings.msg91 ?? {});
      case "gupshup":
        return await sendGupshup(phone, message, settings.gupshup ?? {});
      case "dev":
        return await sendDev(phone, code);
      case "on_screen":
        // The on-screen provider is handled upstream in requestPatientOtp /
        // requestOnScreenOtp — sendOtpSms should never be invoked for it. If
        // it is (e.g. sendTestSms with on_screen selected), return a clear
        // no-op result so the operator sees what happened.
        return {
          ok: false,
          provider: "on_screen",
          error: "On-screen codes are displayed in-browser; no SMS is dispatched.",
        };
      default:
        // Loud failure: an unknown provider id (typo in platform_settings.sms)
        // must never silently fall back to the dev adapter, or OTPs are
        // dropped on the floor in production with no alert.
        throw new Error(
          `Unknown SMS provider configured: "${String(settings.provider)}". ` +
            `Valid values: on_screen, dev, twilio, msg91, gupshup.`,
        );
    }
  } catch (err) {
    return {
      ok: false,
      provider: settings.provider,
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}
