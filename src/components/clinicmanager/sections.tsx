/**
 * Clinic Manager — Sections Barrel
 * ---------------------------------------------------------------
 * This file used to contain the entire clinic-manager dashboard
 * (~2900 lines). It has been split into small, focused modules
 * under `./sections/` and `./shared/`.
 *
 * To keep existing imports working, this file just re-exports the
 * public surface. If you are adding a new section:
 *
 *   1. Create `src/components/clinicmanager/sections/MyNewSection.tsx`
 *      and export a single `MyNewSection` React component.
 *   2. Re-export it from this barrel (see lines below).
 *   3. Wire it into the route file (`$slug_.clinicmanager.tsx` or
 *      `_authenticated/$slug.manage.tsx`) and add the matching item
 *      in `ManagerSidebar.tsx`.
 *
 * See `docs/ADDING-A-FEATURE.md` for the full walkthrough.
 */

// ── Types ──────────────────────────────────────────────────────
export type { DashboardClinic, DashboardDoctor, AppointmentRow, ApptStatus } from "./types";
export { APPT_STATUSES } from "./types";

// ── Shared layout primitives ───────────────────────────────────
export { SectionShell, Card } from "./shared/SectionShell";

// ── Individual sections ────────────────────────────────────────
export { OverviewSection } from "./sections/OverviewSection";
export { ProfileSection } from "./sections/ProfileSection";
export { WorkingHoursSection } from "./sections/WorkingHoursSection";
export { DoctorsSection } from "./sections/DoctorsSection";
export { DashboardSection } from "./sections/DashboardSection";
export { AppointmentsSection } from "./sections/AppointmentsSection";
export { SettingsSection } from "./sections/SettingsSection";
export { TeamSection } from "./sections/TeamSection";
export { CoverSection } from "./sections/CoverSection";
export { StatsSection } from "./sections/StatsSection";
export { TreatmentsSection } from "./sections/TreatmentsSection";
export { TestimonialsSection } from "./sections/TestimonialsSection";
export { GallerySection } from "./sections/GallerySection";
export { MediaLibrarySection } from "./sections/MediaLibrarySection";

// ── Appointment dialog helpers (re-exported for any extra views) ─
export {
  AppointmentDetailSheet,
  AppointmentEditDialog,
  SlotValidationAlert,
  validateAppointmentSlot,
  type SlotValidation,
} from "./sections/AppointmentDialogs";
