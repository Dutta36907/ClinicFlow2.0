/**
 * Per-step validation for the Add Clinic super-admin wizard.
 * Shared by `AddClinicWizard.tsx` so client errors line up with what
 * the server `createClinic` server fn ultimately enforces.
 */
import { z } from "zod";

export const nameSchema = z.string().trim().min(2, "At least 2 characters").max(120, "Max 120 characters");

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(60, "Max 60 characters")
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only");

const optional = <T extends z.ZodTypeAny>(s: T) => s.or(z.literal(""));

export const phoneSchema = optional(
  z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number"),
);

export const emailSchema = optional(
  z.string().email("Enter a valid email").max(255),
);

export const urlSchema = optional(
  z.string().url("Enter a valid URL (https://…)").max(1000),
);

export const mapsUrlSchema = optional(
  z
    .string()
    .url("Enter a valid URL (https://…)")
    .max(1000)
    .refine(
      (v) =>
        /(google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
          v,
        ),
      "Must be a Google Maps share link",
    ),
);

export const addressSchema = optional(z.string().max(500, "Max 500 characters"));

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "Max 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export type WizardForm = {
  name: string;
  slug: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  address: string;
  google_map_url: string;
  preset: string;
  customDate: Date | undefined;
  manager_full_name: string;
  manager_email: string;
  manager_password: string;
};

/** Map of field key → zod schema for blur validation. */
const FIELD_SCHEMAS: Partial<Record<keyof WizardForm, z.ZodTypeAny>> = {
  name: nameSchema,
  slug: slugSchema,
  phone: phoneSchema,
  email: emailSchema,
  whatsapp: phoneSchema,
  website: urlSchema,
  address: addressSchema,
  google_map_url: mapsUrlSchema,
  manager_full_name: nameSchema,
  manager_email: z.string().email("Enter a valid email").max(255),
  manager_password: passwordSchema,
};

export function validateField(
  key: keyof WizardForm,
  value: string,
): string | null {
  const schema = FIELD_SCHEMAS[key];
  if (!schema) return null;
  const r = schema.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Invalid value");
}

export type StepResult = { ok: boolean; errors: Partial<Record<keyof WizardForm, string>> };

export function validateStep(step: number, form: WizardForm): StepResult {
  const errors: Partial<Record<keyof WizardForm, string>> = {};
  const check = (key: keyof WizardForm, value: string) => {
    const err = validateField(key, value);
    if (err) errors[key] = err;
  };

  if (step === 1) {
    check("name", form.name);
    check("slug", form.slug);
  } else if (step === 2) {
    check("phone", form.phone);
    check("email", form.email);
    check("whatsapp", form.whatsapp);
    check("website", form.website);
  } else if (step === 3) {
    check("address", form.address);
    check("google_map_url", form.google_map_url);
  } else if (step === 4) {
    if (form.preset === "custom" && !form.customDate) {
      // surfaced as a separate UI message; not tied to a field
      return { ok: false, errors: {} };
    }
  } else if (step === 5) {
    check("manager_full_name", form.manager_full_name);
    check("manager_email", form.manager_email);
    check("manager_password", form.manager_password);
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export const STEP_FIELDS: Record<number, (keyof WizardForm)[]> = {
  1: ["name", "slug"],
  2: ["phone", "email", "whatsapp", "website"],
  3: ["address", "google_map_url"],
  4: [],
  5: ["manager_full_name", "manager_email", "manager_password"],
  6: [],
};
