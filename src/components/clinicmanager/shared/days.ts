/**
 * Weekday constants and clinic-hours helpers.
 *
 * NOTE on weekday indexing:
 *  - Clinic working_hours is keyed by string: "mon" | "tue" | ... | "sun".
 *  - doctor_schedules.weekday is a number 0..6 where 0 = Sunday.
 * `DAYS` uses the string keys (Monday-first for the UI).
 * `DAY_KEYS` mirrors the 0..6 numeric order (Sun..Sat) so an index lookup
 * matches the database column directly.
 */

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Monday-first list, used by the clinic-hours editor where Mon→Sun reads naturally. */
export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

/** Sunday-first list — index matches `doctor_schedules.weekday`. */
export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Per-day editable shape used by the doctor working-hours editor. */
export type DaySchedule = { active: boolean; start: string; end: string };

/**
 * Seed a doctor's weekly schedule from the clinic's open hours.
 * Returned array is Sun..Sat (matches `DAY_KEYS`).
 */
export function clinicHoursToSchedule(
  working_hours: Record<string, [string, string] | null>,
): DaySchedule[] {
  return DAY_KEYS.map((k) => {
    const v = working_hours?.[k];
    return v && Array.isArray(v)
      ? { active: true, start: v[0], end: v[1] }
      : { active: false, start: "09:00", end: "17:00" };
  });
}
