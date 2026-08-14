/**
 * Booking — Step 5: Done / confirmation screen
 *
 * UI v2: animated success badge, structured summary card, copy
 * confirmation #, "Add to calendar" (.ics download), and a "Book
 * another" secondary action.
 */
import { useMemo } from "react";
import { Calendar, Check, Copy, Stethoscope, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { utcToZonedParts } from "@/lib/clinic-time";
import type { Confirmation, Doctor } from "./types";

function buildIcs({
  uid,
  start,
  summary,
  description,
}: {
  uid: string;
  start: Date;
  summary: string;
  description: string;
}) {
  // 30-minute default duration
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClinicFlow//Appointment//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function DoneStep({
  confirmation,
  doctor,
  clinicTimezone,
  onClose,
}: {
  confirmation: Confirmation;
  doctor: Doctor;
  clinicTimezone: string;
  onClose: () => void;
}) {
  const p = utcToZonedParts(new Date(confirmation.scheduledAt), clinicTimezone);
  const [y, mo, d] = p.date.split("-").map(Number);
  const localDate = new Date(y, (mo || 1) - 1, d || 1);
  const [hh, mm] = p.time.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  const timeLabel = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  const confShort = confirmation.id.slice(0, 8).toUpperCase();

  const icsHref = useMemo(() => {
    const ics = buildIcs({
      uid: confirmation.id,
      start: new Date(confirmation.scheduledAt),
      summary: `Appointment with ${doctor.name}`,
      description: `Confirmation #${confShort}`,
    });
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, [confirmation, doctor, confShort]);

  async function copyConf() {
    try {
      await navigator.clipboard.writeText(confShort);
      toast.success("Confirmation number copied");
    } catch {
      toast.error("Couldn't copy — try selecting it manually.");
    }
  }

  return (
    <div className="space-y-5 py-2 text-center">
      {/* Success badge with ring pulse */}
      <div className="relative mx-auto flex size-16 items-center justify-center">
        <span
          className="absolute inset-0 animate-ping rounded-full bg-primary/20"
          aria-hidden="true"
        />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
          <Check className="size-8" strokeWidth={3} />
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight">You're booked!</h2>
        <p className="text-sm text-muted-foreground">
          A confirmation has been sent. We look forward to seeing you.
        </p>
      </div>

      {/* Summary card */}
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Doctor
            </p>
            <p className="truncate font-medium text-foreground">{doctor.name}</p>
            {doctor.specialization ? (
              <p className="truncate text-xs text-muted-foreground">{doctor.specialization}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-border pt-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Calendar className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              When
            </p>
            <p className="font-medium text-foreground">
              {format(localDate, "EEEE, MMM d")} · {timeLabel}
            </p>
            {clinicTimezone && clinicTimezone !== "UTC" ? (
              <p className="text-xs text-muted-foreground">Clinic time · {clinicTimezone}</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={copyConf}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-left text-xs transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Copy confirmation number ${confShort}`}
        >
          <span className="text-muted-foreground">Confirmation #</span>
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
            {confShort}
            <Copy className="size-3" />
          </span>
        </button>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Button asChild variant="outline" className="sm:w-auto">
          <a href={icsHref} download={`appointment-${confShort}.ics`}>
            <Calendar className="mr-2 size-4" />
            Add to calendar
          </a>
        </Button>
        <Button onClick={onClose} className="sm:w-auto">
          <Sparkles className="mr-2 size-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
