/**
 * EmptyState — reusable empty/no-data placeholder.
 *
 * Use whenever a list/table/section has no rows to show, to keep the
 * visual language consistent across admin, customer, and booking.
 *
 * Usage:
 *   <EmptyState icon={CalendarX} title="No appointments yet"
 *               description="Booked appointments will show up here."
 *               action={<Button>Book one</Button>} />
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** "card" = dashed bordered surface, "plain" = transparent inline */
  variant?: "card" | "plain";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        variant === "card" &&
          "rounded-2xl border border-dashed border-border/70 bg-muted/30",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
