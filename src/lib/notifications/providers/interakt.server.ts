// Interakt WhatsApp Business adapter.
// POST https://api.interakt.ai/v1/public/message/
// Auth: Authorization: Basic base64(apiKey)
// Never throws.

import type { ProviderResult } from "./msg91.server";

export interface InteraktParams {
  apiKey: string;
  baseUrl?: string;
  phone: string; // with or without country code
  templateName: string;
  headerValues?: string[];
  bodyValues: string[];
  buttonValues?: string[];
}

function splitPhone(phone: string): { countryCode: string; number: string } {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    return { countryCode: "+91", number: digits.slice(2) };
  }
  if (digits.length === 10) {
    return { countryCode: "+91", number: digits };
  }
  // Best-effort: assume the prefix is the country code
  return { countryCode: "+" + digits.slice(0, digits.length - 10), number: digits.slice(-10) };
}

export async function sendInteraktWhatsapp(params: InteraktParams): Promise<ProviderResult> {
  const { apiKey, phone, templateName, headerValues = [], bodyValues, buttonValues = [] } = params;
  if (!apiKey) return { success: false, error: "Interakt API key not configured" };
  if (!templateName) return { success: false, error: "WhatsApp template name not configured" };

  const url = params.baseUrl || "https://api.interakt.ai/v1/public/message/";
  const { countryCode, number } = splitPhone(phone);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(apiKey)}`,
      },
      body: JSON.stringify({
        countryCode,
        phoneNumber: number,
        callbackData: "clinicflow",
        type: "Template",
        template: {
          name: templateName,
          languageCode: "en",
          headerValues,
          bodyValues,
          buttonValues,
        },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      result?: boolean;
      id?: string;
      message?: string;
    };
    if (!res.ok || data.result === false) {
      return { success: false, error: data.message || `HTTP ${res.status}` };
    }
    return { success: true, msgId: data.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Interakt request failed" };
  }
}
