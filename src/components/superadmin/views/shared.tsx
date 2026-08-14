// Shared presentational primitives for super-admin views.
// Extracted from the former monolithic superadmin.index.tsx so each view
// owns only its own JSX and data fetching.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, type LucideIcon } from "lucide-react";

export type Tone = "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "muted";

export const toneStyles: Record<Tone, { bg: string; text: string; ring: string; bar: string }> = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    ring: "ring-primary/20",
    bar: "bg-primary",
  },
  "chart-1": {
    bg: "bg-[color:var(--chart-1)]/12",
    text: "text-[color:var(--chart-1)]",
    ring: "ring-[color:var(--chart-1)]/25",
    bar: "bg-[color:var(--chart-1)]",
  },
  "chart-2": {
    bg: "bg-[color:var(--chart-2)]/12",
    text: "text-[color:var(--chart-2)]",
    ring: "ring-[color:var(--chart-2)]/25",
    bar: "bg-[color:var(--chart-2)]",
  },
  "chart-3": {
    bg: "bg-[color:var(--chart-3)]/12",
    text: "text-[color:var(--chart-3)]",
    ring: "ring-[color:var(--chart-3)]/25",
    bar: "bg-[color:var(--chart-3)]",
  },
  "chart-4": {
    bg: "bg-[color:var(--chart-4)]/12",
    text: "text-[color:var(--chart-4)]",
    ring: "ring-[color:var(--chart-4)]/25",
    bar: "bg-[color:var(--chart-4)]",
  },
  "chart-5": {
    bg: "bg-[color:var(--chart-5)]/12",
    text: "text-[color:var(--chart-5)]",
    ring: "ring-[color:var(--chart-5)]/25",
    bar: "bg-[color:var(--chart-5)]",
  },
  muted: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-border",
    bar: "bg-muted-foreground/40",
  },
};

export function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  loading,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  delta?: string;
  loading?: boolean;
  tone?: Tone;
}) {
  const t = toneStyles[tone];
  return (
    <Card className="relative overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${t.bar}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {value.toLocaleString()}
              </p>
            )}
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${t.bg} ${t.text} ring-1 ${t.ring}`}
          >
            <Icon className="size-5" />
          </div>
        </div>
        {delta && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="size-3" /> {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MiniStat({
  label,
  value,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const t = toneStyles[tone];
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex size-9 items-center justify-center rounded-md ${t.bg} ${t.text} ring-1 ${t.ring}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function EmptyMsg({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>;
}
