/**
 * Shared TypeScript types for the clinic manager dashboard.
 *
 * Add a new field here whenever the backend `getManagerDashboard` server
 * function starts returning new data. Every section component reads from
 * these shapes.
 */

/** Clinic information shown across the manager dashboard. */
export type DashboardClinic = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  google_map_url: string | null;
  description: string | null;
  tagline?: string | null;
  logo_url: string | null;
  timezone: string;
  /** Mon..Sun → [openHH:mm, closeHH:mm] | null for "closed". */
  working_hours: Record<string, [string, string] | null>;
  /** Legacy / fallback slot length. Doctors override this per-doctor. */
  appointment_duration_minutes: number;
  is_active: boolean;
  expires_at: string | null;
  cover_image_url?: string | null;
  performance_stats?: { label: string; value: string }[];
};

/** Doctor row used by every manager section that lists doctors. */
export type DashboardDoctor = {
  id: string;
  name: string;
  specialization: string | null;
  degree: string | null;
  years_experience: number | null;
  description: string | null;
  photo_url: string | null;
  is_active: boolean;
  /** Slot length for this doctor's appointments (minutes). Default 15. */
  appointment_duration_minutes: number;
  specialties: string[] | null;
  languages: string[] | null;
};

/** One row in the appointments table — used by Dashboard and Appointments sections. */
export type AppointmentRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  scheduled_at: string;
  status: string;
  doctor_id: string;
  notes: string | null;
  created_at?: string;
};

/** Allowed values for `appointments.status`. Update DB enum + this list together. */
export const APPT_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rescheduled",
] as const;
export type ApptStatus = (typeof APPT_STATUSES)[number];
