// MSG91 transactional SMS adapter (non-OTP).
// Uses the Flow API: POST https://control.msg91.com/api/v5/flow/
// Never throws — always returns the result envelope.

export interface Msg91SmsParams {
  authKey: string;
  senderId?: string;
  templateId: string;
  phone: string;
  /** Map of placeholder name → value, e.g. { VAR1: "Priya", VAR2: "Dr. Sen" } */
  variables: Record<string, string>;
}

export interface ProviderResult {
  success: boolean;
  msgId?: string;
  error?: string;
}

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return "91" + digits;
  throw new Error(`Invalid Indian phone number: ${phone}`);
}

export async function sendMsg91Sms(params: Msg91SmsParams): Promise<ProviderResult> {
  const { authKey, templateId, phone, variables } = params;
  if (!authKey || !templateId) {
    return { success: false, error: "MSG91 not fully configured" };
  }
  let mobile: string;
  try {
    mobile = normalisePhone(phone);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Invalid phone" };
  }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: 0,
        recipients: [{ mobiles: mobile, ...variables }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
      request_id?: string;
    };
    if (!res.ok || data.type === "error") {
      return { success: false, error: data.message || `HTTP ${res.status}` };
    }
    return { success: true, msgId: data.request_id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "MSG91 request failed" };
  }
}
