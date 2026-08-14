/**
 * StatTile — unified stat card used by clinic-manager Dashboard / Overview.
 *
 * label (small caps), big display-font number, optional caption,
 * tinted icon chip using semantic tones.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "info" | "muted";

const TONE: Record<StatTone, { chip: string; bar: string }> = {
  primary: { chip: "bg-primary/10 text-primary ring-primary/20", bar: "bg-primary" },
  success: {
    chip: "bg-[color:var(--success,oklch(0.62_0.14_155))]/12 text-[color:var(--success,oklch(0.45_0.14_155))] ring-[color:var(--success,oklch(0.62_0.14_155))]/20",
    bar: "bg-[color:var(--success,oklch(0.62_0.14_155))]",
  },
  warning: {
    chip: "bg-[color:var(--warning,oklch(0.78_0.16_75))]/15 text-[color:var(--warning,oklch(0.55_0.16_75))] ring-[color:var(--warning,oklch(0.78_0.16_75))]/25",
    bar: "bg-[color:var(--warning,oklch(0.78_0.16_75))]",
  },
  info: {
    chip: "bg-[color:var(--info,oklch(0.62_0.14_235))]/12 text-[color:var(--info,oklch(0.45_0.14_235))] ring-[color:var(--info,oklch(0.62_0.14_235))]/20",
    bar: "bg-[color:var(--info,oklch(0.62_0.14_235))]",
  },
  muted: { chip: "bg-muted text-muted-foreground ring-border", bar: "bg-muted-foreground/40" },
};

export function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  tone = "primary",
  loading,
}: {
  label: string;
  value: number | string;
  caption?: string;
  icon: LucideIcon;
  tone?: StatTone;
  loading?: boolean;
}) {
  const t = TONE[tone];
  return (
    <div className="lift-on-hover relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          )}
          {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
            t.chip,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
