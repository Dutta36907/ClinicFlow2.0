/**
 * StatusBadge — semantic colored pill for appointment / record status.
 *
 * Maps a status string to a tone token (success / warning / destructive /
 * muted / info) so the same status reads the same everywhere in the app.
 */
import { cn } from "@/lib/utils";

export type StatusKind =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled"
  | "active"
  | "inactive"
  | string;

const TONE_CLASS: Record<string, string> = {
  pending:
    "bg-[color:var(--warning,oklch(0.78_0.16_75))]/15 text-[color:var(--warning,oklch(0.55_0.16_75))] ring-[color:var(--warning,oklch(0.78_0.16_75))]/25",
  confirmed:
    "bg-[color:var(--success,oklch(0.62_0.14_155))]/15 text-[color:var(--success,oklch(0.45_0.14_155))] ring-[color:var(--success,oklch(0.62_0.14_155))]/25",
  active:
    "bg-[color:var(--success,oklch(0.62_0.14_155))]/15 text-[color:var(--success,oklch(0.45_0.14_155))] ring-[color:var(--success,oklch(0.62_0.14_155))]/25",
  completed:
    "bg-muted text-muted-foreground ring-border",
  cancelled:
    "bg-destructive/10 text-destructive ring-destructive/20",
  inactive:
    "bg-muted text-muted-foreground ring-border",
  rescheduled:
    "bg-[color:var(--info,oklch(0.62_0.14_235))]/15 text-[color:var(--info,oklch(0.45_0.14_235))] ring-[color:var(--info,oklch(0.62_0.14_235))]/25",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: StatusKind;
  className?: string;
}) {
  const tone = TONE_CLASS[status] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
