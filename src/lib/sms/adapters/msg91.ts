// MSG91 OTP API adapter. Uses the dedicated /api/v5/otp endpoint so the
// templateId / senderId pair you configured in MSG91 controls the message body.
// Docs: https://docs.msg91.com/p/tf9GTextN/e/X4iAcVH7Aw/MSG91
import type { SmsResult } from "../provider.server";

type Msg91Cfg = { authKey?: string; senderId?: string; templateId?: string };

export async function sendMsg91(phone: string, otp: string, cfg: Msg91Cfg): Promise<SmsResult> {
  const { authKey, templateId, senderId } = cfg;
  if (!authKey || !templateId) {
    return { ok: false, provider: "msg91", error: "MSG91 is not fully configured" };
  }
  // MSG91 expects mobile without leading "+"
  const mobile = phone.replace(/\D/g, "");
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", otp);
  if (senderId) url.searchParams.set("sender", senderId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { authkey: authKey, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    type?: string;
    message?: string;
    request_id?: string;
  };
  if (!res.ok || data.type === "error") {
    return { ok: false, provider: "msg91", error: data.message || `HTTP ${res.status}` };
  }
  return { ok: true, provider: "msg91", messageId: data.request_id };
}
