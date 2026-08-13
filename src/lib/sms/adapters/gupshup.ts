// Gupshup Enterprise SMS API adapter.
// Docs: https://docs.gupshup.io/docs/send-text-messages
import type { SmsResult } from "../provider.server";

type GupshupCfg = { apiKey?: string; source?: string; appName?: string };

export async function sendGupshup(
  phone: string,
  message: string,
  cfg: GupshupCfg,
): Promise<SmsResult> {
  const { apiKey, source } = cfg;
  if (!apiKey || !source) {
    return { ok: false, provider: "gupshup", error: "Gupshup is not fully configured" };
  }
  const destination = phone.replace(/\D/g, "");
  const body = new URLSearchParams({
    method: "SendMessage",
    send_to: destination,
    msg: message,
    msg_type: "TEXT",
    userid: source,
    auth_scheme: "plain",
    v: "1.1",
    format: "json",
    password: apiKey,
  });
  const res = await fetch(`https://enterprise.smsgupshup.com/GatewayAPI/rest?${body.toString()}`, {
    method: "GET",
  });
  const text = await res.text();
  if (!res.ok || /error/i.test(text)) {
    return { ok: false, provider: "gupshup", error: text || `HTTP ${res.status}` };
  }
  return { ok: true, provider: "gupshup" };
}
