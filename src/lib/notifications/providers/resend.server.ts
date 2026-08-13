// Resend email adapter. Renders React Email templates and sends.
// Never throws — returns result envelope.

import { Resend } from "resend";
import type { ReactElement } from "react";
import type { ProviderResult } from "./msg91.server";

export interface ResendEmailParams {
  apiKey: string;
  from: string; // e.g. "appointments@yourdomain.com"
  fromName: string;
  to: string;
  subject: string;
  reactTemplate?: ReactElement;
  text?: string;
}

export async function sendResendEmail(params: ResendEmailParams): Promise<ProviderResult> {
  const { apiKey, from, fromName, to, subject, reactTemplate, text } = params;
  if (!apiKey) return { success: false, error: "Resend API key not configured" };
  if (!from) return { success: false, error: "From address not configured" };
  if (!reactTemplate && !text) {
    return { success: false, error: "No email body (react or text) provided" };
  }
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromName ? `${fromName} <${from}>` : from,
      to,
      subject,
      ...(reactTemplate ? { react: reactTemplate } : { text: text! }),
    });
    if (error) return { success: false, error: error.message || "Resend error" };
    return { success: true, msgId: data?.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Resend request failed" };
  }
}
