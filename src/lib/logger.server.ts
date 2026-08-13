/**
 * Tiny structured server-side logger. Emits one JSON object per line so the
 * Cloudflare log tail / Server Logs UI can be searched and filtered.
 *
 * Never include PHI here: patient names, phone numbers, emails, OTP codes,
 * JWTs, or any value from the patient_otp table. Pass identifiers
 * (clinic_id, user_id, action) and counters only.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  action: string;
  clinic_id?: string | null;
  user_id?: string | null;
  error_code?: string | null;
  duration_ms?: number | null;
  [key: string]: unknown;
}

function emit(level: LogLevel, fields: LogFields) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (fields: LogFields) => emit("debug", fields),
  info: (fields: LogFields) => emit("info", fields),
  warn: (fields: LogFields) => emit("warn", fields),
  error: (fields: LogFields) => emit("error", fields),
};
