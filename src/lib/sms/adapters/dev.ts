// Dev adapter — never sends a real SMS. The OTP server function detects
// this provider and returns `devCode` in the response (dev-builds only) so
// testing works without a paid SMS account. Replace with a real provider
// in production.
import type { SmsResult } from "../provider.server";
import { logger } from "@/lib/logger.server";
import { maskPhone } from "@/lib/errors";

export async function sendDev(phone: string, _code: string): Promise<SmsResult> {
  // Never log the plaintext OTP. The dev provider's contract is that the
  // code is surfaced via the requestPatientOtp response (dev builds only)
  // and via sendTestSms — log only that a dev dispatch happened.
  logger.info({
    action: "sms.dispatch",
    provider: "dev",
    phone_last4: maskPhone(phone),
  });
  return { ok: true, provider: "dev", dev: true };
}
