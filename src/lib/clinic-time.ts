// Timezone helpers for interpreting clinic-local wall times.
// Uses only Intl.DateTimeFormat — Cloudflare Worker-safe, no deps.

function getZoneOffsetMs(utcMs: number, tz: string): number {
  // Returns offsetMs such that: localWallTime = utcMs + offsetMs.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/** Convert a wall-clock time (`YYYY-MM-DD`, `HH:mm[:ss]`) in `tz` to a UTC Date. */
export function zonedWallTimeToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  // First approximation: treat as UTC, then correct by the zone offset at that instant.
  const approxUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Two passes handle DST transitions correctly.
  let offset = getZoneOffsetMs(approxUtc, tz);
  let utc = approxUtc - offset;
  offset = getZoneOffsetMs(utc, tz);
  utc = approxUtc - offset;
  return new Date(utc);
}

/** Format a UTC instant into clinic-local date / time / weekday (0=Sun..6=Sat). */
export function utcToZonedParts(
  instant: Date,
  tz: string,
): { date: string; time: string; weekday: number; minOfDay: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const wkMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = wkMap[get("weekday")] ?? 0;
  return {
    date: `${y}-${mo}-${d}`,
    time: `${hh}:${mm}`,
    weekday,
    minOfDay: Number(hh) * 60 + Number(mm),
  };
}

/** Format an "HH:mm" or "HH:mm:ss" wall-clock string as a 12-hour label like "9:00 AM". */
export function formatTime12(hhmm: string): string {
  if (!hhmm) return "";
  const [hStr, mStr = "0"] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format a "HH:mm"–"HH:mm" range as 12-hour ("9:00 AM – 5:00 PM"). */
export function formatRange12(start: string, end: string): string {
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}
