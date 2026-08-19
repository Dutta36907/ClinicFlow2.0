/**
 * Booking — small shared pieces (Back button + step indicator).
 *
 * UI v2: animated progress bar + numbered pills with check icon on
 * completed steps. Active label always visible (mobile + desktop) so
 * users always know where they are in the flow.
 */
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step } from "./types";

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Go back to previous step"
    >
      <ArrowLeft className="size-3.5" /> Back
    </button>
  );
}

const STEP_ORDER: Step[] = ["doctor", "datetime", "details", "verify"];
const STEP_LABELS = ["Doctor", "Date & time", "Details", "Verify"];

export function DialogStepper({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  const progress = ((idx + 1) / STEP_ORDER.length) * 100;

  return (
    <div className="mb-3 space-y-2.5" aria-label="Booking progress">
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="flex items-center justify-between gap-1.5">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === idx;
          const isComplete = i < idx;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 items-center gap-1.5"
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-300",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isActive &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15 scale-105",
                  !isActive && !isComplete && "border-border bg-card text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs transition-colors",
                  isActive
                    ? "font-semibold text-foreground"
                    : "hidden text-muted-foreground sm:inline",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
