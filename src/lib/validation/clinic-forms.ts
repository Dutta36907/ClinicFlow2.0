/**
 * Client-side validation helpers for clinic-manager forms.
 *
 * These mirror the zod schemas in `src/lib/clinicmanager.functions.ts` so the
 * UI can show inline errors BEFORE submitting (and matches the server's hard
 * limits exactly — if you change one, change the other).
 *
 * Each `validateX` returns:
 *   { ok: true,  errors: {} }
 *   { ok: false, errors: { fieldName: "human readable message" } }
 *
 * Components should:
 *   1. Use `LIMITS` to drive `maxLength` on every `<Field>` (hard cap input).
 *   2. Call the right `validateX` on submit, block save if not `ok`, and
 *      pass `errors.fieldName` into each `<Field error={...}>`.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Single source of truth for limits (mirrors clinicmanager.functions.ts)
// ---------------------------------------------------------------------------
export const LIMITS = {
  name: { min: 2, max: 120 },
  specialization: { max: 120 },
  degree: { max: 120 },
  description: { max: 2000 },
  tagline: { max: 160 },
  url: { max: 1000 },
  phone: { max: 40 },
  email: { max: 255 },
  address: { max: 500 },
  yearsExperience: { min: 0, max: 80 },
  password: { min: 8, max: 72 },
  fullName: { min: 2, max: 120 },
  notes: { max: 2000 },
  tag: { max: 60 },
  tagList: { max: 12 },
} as const;

// ---------------------------------------------------------------------------
// Reusable atoms
// ---------------------------------------------------------------------------
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .or(z.literal(""));

const optionalUrl = (max: number, label: string) =>
  z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .url(`${label} must be a valid URL (https://…)`)
        .max(max, `${label} must be at most ${max} characters`),
    ])
    .optional();

const optionalEmail = (max: number, label: string) =>
  z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .email(`${label} must be a valid email`)
        .max(max, `${label} must be at most ${max} characters`),
    ])
    .optional();

// ---------------------------------------------------------------------------
// Doctor form
// ---------------------------------------------------------------------------
const tagListInput = (label: string) =>
  z
    .string()
    .trim()
    .max(LIMITS.tag.max * LIMITS.tagList.max + LIMITS.tagList.max * 2)
    .refine((v) => {
      if (!v) return true;
      const items = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length > LIMITS.tagList.max) return false;
      return items.every((it) => it.length <= LIMITS.tag.max);
    }, `${label} must be a comma-separated list (max ${LIMITS.tagList.max} items, each up to ${LIMITS.tag.max} chars)`);

const doctorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.name.min, `Name must be at least ${LIMITS.name.min} characters`)
    .max(LIMITS.name.max, `Name must be at most ${LIMITS.name.max} characters`),
  specialization: optionalText(LIMITS.specialization.max, "Specialization"),
  degree: optionalText(LIMITS.degree.max, "Degree"),
  years_experience: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (/^\d+$/.test(v) &&
          Number(v) >= LIMITS.yearsExperience.min &&
          Number(v) <= LIMITS.yearsExperience.max),
      `Years of experience must be a whole number between ${LIMITS.yearsExperience.min} and ${LIMITS.yearsExperience.max}`,
    ),
  description: optionalText(LIMITS.description.max, "Description"),
  photo_url: optionalUrl(LIMITS.url.max, "Photo URL"),
  specialties: tagListInput("Specialties").optional(),
  languages: tagListInput("Languages").optional(),
});

export type DoctorFormInput = z.input<typeof doctorSchema>;

// ---------------------------------------------------------------------------
// Clinic profile form
// ---------------------------------------------------------------------------
const clinicProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.name.min, `Clinic name must be at least ${LIMITS.name.min} characters`)
    .max(LIMITS.name.max, `Clinic name must be at most ${LIMITS.name.max} characters`),
  phone: optionalText(LIMITS.phone.max, "Phone"),
  email: optionalEmail(LIMITS.email.max, "Email"),
  whatsapp: optionalText(LIMITS.phone.max, "WhatsApp"),
  website: optionalUrl(LIMITS.url.max, "Website"),
  address: optionalText(LIMITS.address.max, "Address"),
  google_map_url: optionalUrl(LIMITS.url.max, "Google Maps URL"),
  description: optionalText(LIMITS.description.max, "Description"),
  tagline: optionalText(LIMITS.tagline.max, "Tagline"),
  logo_url: optionalUrl(LIMITS.url.max, "Logo URL"),
});

export type ClinicProfileFormInput = z.input<typeof clinicProfileSchema>;

// ---------------------------------------------------------------------------
// Team / add clinic user form
// ---------------------------------------------------------------------------
const teamMemberSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(LIMITS.fullName.min, `Full name must be at least ${LIMITS.fullName.min} characters`)
    .max(LIMITS.fullName.max, `Full name must be at most ${LIMITS.fullName.max} characters`),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(LIMITS.email.max, `Email must be at most ${LIMITS.email.max} characters`),
  password: z
    .string()
    .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters`)
    .max(LIMITS.password.max, `Password must be at most ${LIMITS.password.max} characters`),
});

export type TeamMemberFormInput = z.input<typeof teamMemberSchema>;

// ---------------------------------------------------------------------------
// Appointment patient details
// ---------------------------------------------------------------------------
const appointmentPatientSchema = z.object({
  patient_name: z
    .string()
    .trim()
    .min(LIMITS.name.min, `Patient name must be at least ${LIMITS.name.min} characters`)
    .max(LIMITS.name.max, `Patient name must be at most ${LIMITS.name.max} characters`),
  patient_phone: z
    .string()
    .trim()
    .min(4, "Phone is required")
    .max(LIMITS.phone.max, `Phone must be at most ${LIMITS.phone.max} characters`),
  patient_email: optionalEmail(LIMITS.email.max, "Email"),
  notes: optionalText(LIMITS.notes.max, "Notes"),
});

export type AppointmentPatientFormInput = z.input<typeof appointmentPatientSchema>;

// ---------------------------------------------------------------------------
// Generic runner: turn a ZodError into a flat { field: message } map
// ---------------------------------------------------------------------------
type ValidateResult<T> =
  | { ok: true; data: T; errors: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

function run<S extends z.ZodTypeAny>(schema: S, input: unknown): ValidateResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    // Keep the first error per field — that's what the UI shows.
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

export const validateDoctorForm = (input: unknown) => run(doctorSchema, input);
export const validateClinicProfile = (input: unknown) => run(clinicProfileSchema, input);
export const validateTeamMember = (input: unknown) => run(teamMemberSchema, input);
export const validateAppointmentPatient = (input: unknown) => run(appointmentPatientSchema, input);

// ---------------------------------------------------------------------------
// Server-error formatter — turns a stringified zod issue array (which is what
// `inputValidator((d) => schema.parse(d))` throws) into a readable sentence.
// ---------------------------------------------------------------------------
export function formatServerError(err: unknown, fallback = "Something went wrong"): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg) return fallback;
  const trimmed = msg.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const issues = Array.isArray(parsed) ? parsed : parsed?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        const field =
          Array.isArray(first?.path) && first.path.length > 0 ? first.path.join(".") : null;
        const message = first?.message ?? fallback;
        return field ? `${field}: ${message}` : message;
      }
    } catch {
      // fall through
    }
  }
  return msg;
}
