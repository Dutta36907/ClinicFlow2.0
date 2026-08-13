/**
 * Booking — shared types
 * Used by every step of the booking dialog.
 */

export type Doctor = {
  id: string;
  name: string;
  degree: string | null;
  photo_url: string | null;
  description: string | null;
  years_experience: number | null;
  specialization: string | null;
};

export type Step = "doctor" | "datetime" | "details" | "verify" | "done";

export type PatientForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export type OtpProvider = "on_screen" | "sms" | "dev";

export type Confirmation = {
  id: string;
  scheduledAt: string;
};
