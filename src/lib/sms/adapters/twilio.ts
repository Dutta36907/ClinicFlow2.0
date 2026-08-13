// Twilio REST API adapter — POST /Messages.json with Basic auth.
// Docs: https://www.twilio.com/docs/messaging/api
import type { SmsResult } from "../provider.server";

type TwilioCfg = { accountSid?: string; authToken?: string; fromNumber?: string };

export async function sendTwilio(
  phone: string,
  message: string,
  cfg: TwilioCfg,
): Promise<SmsResult> {
  const { accountSid, authToken, fromNumber } = cfg;
  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, provider: "twilio", error: "Twilio is not fully configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: fromNumber, Body: message });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) {
    return { ok: false, provider: "twilio", error: data.message || `HTTP ${res.status}` };
  }
  return { ok: true, provider: "twilio", messageId: data.sid };
}
