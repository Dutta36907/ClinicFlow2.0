/**
 * Booking — Step 1: Doctor picker
 *
 * Shown only when the user didn't open the dialog from a doctor card.
 * UI v2: richer card with avatar ring, specialty chip, experience pill,
 * keyboard focus ring, and a structured empty state.
 */
import { ChevronRight, Sparkles, Stethoscope, UserRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Doctor } from "./types";

export function DoctorPickStep({
  doctors,
  onPick,
}: {
  doctors: Doctor[];
  onPick: (d: Doctor) => void;
}) {
  if (doctors.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No doctors available yet"
        description="The clinic hasn't added any doctors to the booking flow. Please check back later."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose a doctor to see their available slots.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {doctors.map((d) => (
          <DoctorCard key={d.id} doctor={d} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function DoctorCard({
  doctor: d,
  onPick,
}: {
  doctor: Doctor;
  onPick: (d: Doctor) => void;
}) {
  const initials = d.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onPick(d)}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={`Choose Dr. ${d.name}`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {d.photo_url ? (
          <img
            src={d.photo_url}
            alt=""
            loading="lazy"
            className="size-14 rounded-full object-cover ring-2 ring-primary/10 ring-offset-2 ring-offset-card transition-all group-hover:ring-primary/30"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent text-base font-semibold text-primary ring-2 ring-primary/10 ring-offset-2 ring-offset-card">
            {initials || <UserRound className="size-6" />}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
          {d.name}
        </div>
        {d.specialization ? (
          <div className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Stethoscope className="size-3 shrink-0" />
            <span className="truncate">{d.specialization}</span>
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {d.degree ? <span className="truncate">{d.degree}</span> : null}
          {d.degree && d.years_experience ? <span aria-hidden>·</span> : null}
          {d.years_experience ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-3" />
              {d.years_experience}+ yrs
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </button>
  );
}
