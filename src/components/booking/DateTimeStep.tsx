/**
 * Booking — Step 2: Date + Time
 *
 * Shows a calendar on the left and the slot grid (Morning / Afternoon /
 * Evening) on the right. Slots come from the `getAvailableSlots` server
 * function and are pre-filtered for time-off and past times.
 *
 * UI v2: skeleton loader for the slot grid, denser slot pills with
 * count chips, sticky Continue CTA on mobile, accessible labels.
 */
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CalendarCheck, CalendarX, Clock, Sun, Sunrise, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { utcToZonedParts, formatRange12 } from "@/lib/clinic-time";
import { getAvailableSlots } from "@/lib/public.functions";
import { BackBtn } from "./parts";
import type { Doctor } from "./types";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DateTimeStep({
  doctor,
  date,
  setDate,
  slot,
  setSlot,
  onBack,
  onNext,
  canBack,
}: {
  doctor: Doctor;
  date: Date | undefined;
  setDate: (d: Date | undefined) => void;
  slot: string | null;
  setSlot: (s: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  canBack: boolean;
}) {
  const fetchSlots = useServerFn(getAvailableSlots);
  const dateStr = date ? format(date, "yyyy-MM-dd") : null;

  const slotsQ = useQuery({
    queryKey: ["slots", doctor.id, dateStr],
    queryFn: () => fetchSlots({ data: { doctorId: doctor.id, date: dateStr! } }),
    enabled: !!dateStr,
    // Slots rarely change within a single booking session; 30s is a good
    // balance between freshness and not hammering the server on every
    // calendar click.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Reset the chosen slot whenever the date changes.
  useEffect(() => {
    setSlot(null);
  }, [dateStr, setSlot]);

  const data = slotsQ.data;

  // Group weekly availability by weekday for the side panel.
  const weeklyByDay = new Map<number, { start: string; end: string }[]>();
  for (const w of data?.weeklyHours ?? []) {
    const list = weeklyByDay.get(w.weekday) ?? [];
    list.push({ start: w.start, end: w.end });
    weeklyByDay.set(w.weekday, list);
  }

  return (
    <div className="space-y-4 pb-2">
      {canBack && <BackBtn onClick={onBack} />}

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Left: calendar + weekly availability (desktop) ─────── */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-2 sm:p-3 shadow-sm">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              className="pointer-events-auto mx-auto"
            />
          </div>

          {data?.weeklyHours && data.weeklyHours.length > 0 && (
            <div className="hidden md:block rounded-2xl border border-border bg-card p-3 text-sm shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {doctor.name}'s weekly availability
              </div>
              <ul className="space-y-1">
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const windows = weeklyByDay.get(wd);
                  return (
                    <li key={wd} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{WEEKDAY_NAMES[wd]}</span>
                      <span className={windows ? "" : "text-muted-foreground/60"}>
                        {windows
                          ? windows.map((w) => formatRange12(w.start, w.end)).join(", ")
                          : "Off"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {data.timezone && data.timezone !== "UTC" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Times shown in clinic timezone ({data.timezone}).
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: slot grid + helper messages ───────────────── */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {date ? format(date, "EEEE, MMM d") : "Select a date"}
            </div>
            {date && data && data.slots.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {data.slots.filter((s) => !s.booked).length} open
              </span>
            )}
          </div>

          {!date && (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Pick a date on the calendar to see {doctor.name}'s available times.
            </p>
          )}

          {date && slotsQ.isLoading && <SlotGridSkeleton />}

          {date && slotsQ.isError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-destructive">
                  Couldn't load available times
                </p>
                <p className="mt-1 text-muted-foreground">
                  Please check your connection and try again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => slotsQ.refetch()}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {date && data && data.dayOff && (
            <InfoBox
              icon={CalendarX}
              title={`Not scheduled on ${format(date, "EEEE")}s`}
              body={`${doctor.name} doesn't hold appointments on this weekday. Pick a day shown in the weekly availability.`}
            />
          )}

          {date && data && !data.dayOff && data.fullyBlocked && (
            <InfoBox
              tone="warn"
              icon={Clock}
              title={`${doctor.name} is on time off all day`}
              body={
                "No appointments are available on this date. Please choose a different day."
              }
            />
          )}

          {date && data && !data.dayOff && !data.fullyBlocked && data.timeOffBlocks.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="font-medium">Partial time off on this day</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {data.timeOffBlocks.map((b, i) => (
                      <li key={i}>
                        {b.start && b.end ? formatRange12(b.start, b.end) : "All day"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {date && data && !data.dayOff && !data.fullyBlocked && data.workingWindows.length > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {doctor.name}'s hours:{" "}
              {data.workingWindows.map((w) => formatRange12(w.start, w.end)).join(", ")}
            </p>
          )}

          {date && data && data.slots.length > 0 && data.slots.every((s) => s.booked) && (
            <InfoBox
              icon={CalendarCheck}
              title="Fully booked for this day"
              body={`Every appointment with ${doctor.name} is taken. Try another date.`}
            />
          )}

          {date && data && data.slots.length === 0 && !data.dayOff && !data.fullyBlocked && (
            <InfoBox
              icon={CalendarCheck}
              title={
                data.timeOffBlocks.length > 0
                  ? "No slots remaining around the time off"
                  : "Fully booked for this day"
              }
              body={
                data.timeOffBlocks.length > 0
                  ? "All slots outside the time-off window are taken or have passed. Try another date."
                  : `Every appointment with ${doctor.name} is taken or has already passed. Try another date.`
              }
            />
          )}

          {date && data && data.slots.length > 0 && (
            <SlotGrid
              slots={data.slots}
              clinicTz={data.timezone || "UTC"}
              selected={slot}
              onSelect={setSlot}
            />
          )}

          {/* Mobile-only collapsible weekly availability */}
          {data?.weeklyHours && data.weeklyHours.length > 0 && (
            <details className="md:hidden mt-3 rounded-2xl border border-border bg-card text-sm shadow-sm group">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                <span>{doctor.name}'s weekly availability</span>
                <span className="text-[10px] text-muted-foreground group-open:hidden">Show</span>
                <span className="text-[10px] text-muted-foreground hidden group-open:inline">Hide</span>
              </summary>
              <div className="px-3 pb-3">
                <ul className="space-y-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                    const windows = weeklyByDay.get(wd);
                    return (
                      <li key={wd} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{WEEKDAY_NAMES[wd]}</span>
                        <span className={windows ? "" : "text-muted-foreground/60"}>
                          {windows
                            ? windows.map((w) => formatRange12(w.start, w.end)).join(", ")
                            : "Off"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {data.timezone && data.timezone !== "UTC" && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Times shown in clinic timezone ({data.timezone}).
                  </p>
                )}
              </div>
            </details>
          )}

          {/* Desktop continue */}
          <Button
            className="mt-4 hidden w-full md:inline-flex"
            disabled={!slot}
            onClick={onNext}
          >
            <CalendarCheck className="mr-2 size-4" /> Continue
          </Button>
        </div>
      </div>

      {/* Mobile sticky CTA — pinned to dialog scroll bottom */}
      <div className="sticky bottom-0 -mx-4 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-medium text-foreground truncate">
              {slot
                ? format(new Date(slot), "EEE, MMM d · h:mm a")
                : "Select a time"}
            </div>
            <div className="truncate text-muted-foreground">{doctor.name}</div>
          </div>
          <Button size="sm" disabled={!slot} onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Internal helpers ────────────────────────────────────────── */

function InfoBox({
  icon: Icon,
  title,
  body,
  tone = "muted",
}: {
  icon: typeof Clock;
  title: string;
  body: string;
  tone?: "muted" | "warn";
}) {
  const wrap =
    tone === "warn"
      ? "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      : "rounded-xl border border-border bg-muted/30 p-4 text-sm";
  const icon =
    tone === "warn"
      ? "mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      : "mt-0.5 size-4 shrink-0 text-muted-foreground";
  return (
    <div className={wrap}>
      <div className="flex items-start gap-3">
        <Icon className={icon} />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

function SlotGridSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading time slots">
      {[0, 1].map((g) => (
        <div key={g}>
          <Skeleton className="mb-2 h-3 w-24" />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const GROUP_ICONS = {
  Morning: Sunrise,
  Afternoon: Sun,
  Evening: Sunset,
} as const;

/**
 * Slot grid grouped into Morning / Afternoon / Evening based on the
 * clinic-local hour-of-day.
 */
function SlotGrid({
  slots,
  clinicTz,
  selected,
  onSelect,
}: {
  slots: { time: string; booked: boolean }[];
  clinicTz: string;
  selected: string | null;
  onSelect: (s: string) => void;
}) {
  const fmt12 = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  type Slot = { time: string; booked: boolean };
  const groups: { label: keyof typeof GROUP_ICONS; slots: Slot[] }[] = [
    { label: "Morning", slots: [] },
    { label: "Afternoon", slots: [] },
    { label: "Evening", slots: [] },
  ];
  for (const s of slots) {
    const { minOfDay } = utcToZonedParts(new Date(s.time), clinicTz);
    if (minOfDay < 12 * 60) groups[0].slots.push(s);
    else if (minOfDay < 17 * 60) groups[1].slots.push(s);
    else groups[2].slots.push(s);
  }

  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.slots.length > 0)
        .map((g) => {
          const available = g.slots.filter((s) => !s.booked).length;
          const Icon = GROUP_ICONS[g.label];
          return (
            <div key={g.label}>
              <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{g.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
                  {available}/{g.slots.length}
                </span>
              </h4>
              <div
                className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
                role="radiogroup"
                aria-label={`${g.label} time slots`}
              >
                {g.slots.map((s) => {
                  const { minOfDay } = utcToZonedParts(new Date(s.time), clinicTz);
                  const isSelected = selected === s.time;
                  const label = fmt12(minOfDay);
                  return (
                    <button
                      key={s.time}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => !s.booked && onSelect(s.time)}
                      disabled={s.booked}
                      aria-disabled={s.booked}
                      aria-label={
                        s.booked ? `${label} — already booked` : label
                      }
                      title={s.booked ? "Already booked" : undefined}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                        s.booked
                          ? "cursor-not-allowed border-border/60 bg-muted/50 text-muted-foreground/70 line-through"
                          : isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                            : "border-border hover:border-primary hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98]",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-border bg-background" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-primary bg-primary" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-border/60 bg-muted" />
          Booked
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Times shown in clinic time{clinicTz && clinicTz !== "UTC" ? ` (${clinicTz})` : ""}.
      </p>
    </div>
  );
}
