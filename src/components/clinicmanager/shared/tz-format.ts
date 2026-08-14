/**
 * Timezone-aware date helpers tuned for the manager dashboard.
 *
 * These compute clinic-local day boundaries (so "Today's appointments"
 * means today in the *clinic's* timezone, not the manager's browser
 * timezone) and format ISO strings into friendly labels like
 * "Today, 3:00 PM".
 *
 * For deeper timezone math (wall-time ↔ UTC conversion) use
 * `src/lib/clinic-time.ts`.
 */

/** Break a Date into the clinic-local calendar/clock components. */
export function tzParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  // Some locales emit "24" for midnight; normalise to 0.
  const hour = o.hour === "24" ? 0 : Number(o.hour);
  return {
    year: +o.year,
    month: +o.month,
    day: +o.day,
    hour,
    minute: +o.minute,
    second: +o.second,
  };
}

/**
 * Midnight at the start of a clinic-local day, returned as a UTC `Date`.
 * `offsetDays = 0` means today, `1` means tomorrow, etc.
 *
 * Why the two-step probe: we don't know the zone's offset upfront and
 * we need to handle DST transitions correctly, so we measure the offset
 * relative to the requested wall time.
 */
export function tzDayStart(tz: string, offsetDays = 0): Date {
  const p = tzParts(new Date(), tz);
  const wallUTC = Date.UTC(p.year, p.month - 1, p.day + offsetDays, 0, 0, 0);
  const probeParts = tzParts(new Date(wallUTC), tz);
  const probeWallUTC = Date.UTC(
    probeParts.year,
    probeParts.month - 1,
    probeParts.day,
    probeParts.hour,
    probeParts.minute,
    probeParts.second,
  );
  const offsetMs = probeWallUTC - wallUTC;
  return new Date(wallUTC - offsetMs);
}

/** Stable "YYYY-M-D" key for a given ISO timestamp in clinic time. Used for grouping. */
export function tzDateKey(iso: string, tz: string) {
  const p = tzParts(new Date(iso), tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Convenience wrapper around Intl.DateTimeFormat — formats an ISO string in `tz`. */
export function formatInTz(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
}

/**
 * Human-friendly label:
 *  - "Today, 3:00 PM"
 *  - "Tomorrow, 9:30 AM"
 *  - "Fri, Mar 14, 2:00 PM"  (anything else)
 */
export function formatNice(iso: string, tz: string) {
  const todayKey = tzDateKey(new Date().toISOString(), tz);
  const tomorrowKey = tzDateKey(new Date(Date.now() + 86400000).toISOString(), tz);
  const key = tzDateKey(iso, tz);
  const time = formatInTz(iso, tz, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (key === todayKey) return `Today, ${time}`;
  if (key === tomorrowKey) return `Tomorrow, ${time}`;
  return formatInTz(iso, tz, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
