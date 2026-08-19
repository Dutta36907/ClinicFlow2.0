// Pure HH:mm slot math driven by a doctor's weekly schedule, time-off
// overrides, and the doctor's own appointment interval. No timezone math —
// callers pass clinic-local wall-time strings.

export type Schedule = {
  weekday: number;
  start_time: string; // "HH:mm" or "HH:mm:ss"
  end_time: string;
  is_active: boolean;
};

export type Override = {
  date: string; // "YYYY-MM-DD"
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
};

export type Window = { start: string; end: string }; // "HH:mm"

const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (n: number): string => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Weekday (0=Sun..6=Sat) for a YYYY-MM-DD string, treated as a calendar date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  // Construct at noon UTC to avoid any DST edge cases when reading the day.
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12)).getUTCDay();
}

/** Subtract a list of blocked [start,end) ranges from a working window list. */
function subtractBlocks(windows: Window[], blocks: Window[]): Window[] {
  let out = windows.map((w) => ({ start: toMin(w.start), end: toMin(w.end) }));
  for (const b of blocks) {
    const bs = toMin(b.start);
    const be = toMin(b.end);
    const next: { start: number; end: number }[] = [];
    for (const w of out) {
      if (be <= w.start || bs >= w.end) {
        next.push(w);
        continue;
      }
      if (bs > w.start) next.push({ start: w.start, end: Math.min(bs, w.end) });
      if (be < w.end) next.push({ start: Math.max(be, w.start), end: w.end });
    }
    out = next.filter((w) => w.end > w.start);
  }
  return out.map((w) => ({ start: fromMin(w.start), end: fromMin(w.end) }));
}

export type DoctorDaySlots = {
  weekday: number;
  dayOff: boolean; // no active schedule for this weekday
  fullyBlocked: boolean; // an all-day time-off override exists for this date
  windows: Window[]; // working windows for this weekday (raw, from schedule)
  freeWindows: Window[]; // working windows minus time-off blocks
  startOptions: string[]; // every interval step inside freeWindows
  endOptionsFor: (start: string) => string[];
};

export function generateDoctorSlots(args: {
  date: string;
  schedules: Schedule[];
  overrides: Override[];
  intervalMinutes: number;
}): DoctorDaySlots {
  const interval = Math.max(1, args.intervalMinutes || 15);
  const weekday = weekdayOf(args.date);
  const todays = args.overrides.filter((o) => o.date === args.date && o.is_blocked);
  const fullyBlocked = todays.some((o) => !o.start_time && !o.end_time);

  const windows: Window[] = args.schedules
    .filter((s) => s.weekday === weekday && s.is_active)
    .map((s) => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }))
    .sort((a, b) => toMin(a.start) - toMin(b.start));

  const dayOff = windows.length === 0;

  const blocks: Window[] = todays
    .filter((o) => o.start_time && o.end_time)
    .map((o) => ({
      start: (o.start_time as string).slice(0, 5),
      end: (o.end_time as string).slice(0, 5),
    }));

  const freeWindows = fullyBlocked || dayOff ? [] : subtractBlocks(windows, blocks);

  const startOptions: string[] = [];
  for (const w of freeWindows) {
    const ws = toMin(w.start);
    const we = toMin(w.end);
    for (let t = ws; t + interval <= we; t += interval) startOptions.push(fromMin(t));
    // Trailing "extra" slot: allow one more appointment starting at the
    // window's closing time, running one interval past it. Keeps the same
    // slot rhythm and gives the doctor a final consult of the shift.
    startOptions.push(fromMin(we));
  }

  const endOptionsFor = (start: string): string[] => {
    const sMin = toMin(start);
    // Normal case: start sits inside a free window.
    const w = freeWindows.find((win) => toMin(win.start) <= sMin && toMin(win.end) > sMin);
    if (w) {
      const out: string[] = [];
      const we = toMin(w.end);
      for (let t = sMin + interval; t <= we; t += interval) out.push(fromMin(t));
      // Always include the window's exact end so users can block right up to closing.
      if (out[out.length - 1] !== w.end) out.push(w.end);
      return out;
    }
    // Trailing slot: start === window end → one interval past closing.
    const trailing = freeWindows.find((win) => toMin(win.end) === sMin);
    if (trailing) return [fromMin(sMin + interval)];
    return [];
  };

  return { weekday, dayOff, fullyBlocked, windows, freeWindows, startOptions, endOptionsFor };
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
