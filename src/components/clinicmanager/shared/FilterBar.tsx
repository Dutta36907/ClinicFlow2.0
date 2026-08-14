/**
 * FilterBar — shared horizontal filter strip.
 *
 * Wraps children in a single row that:
 *  - aligns inputs / selects / counts consistently
 *  - horizontally scrolls on narrow viewports (`.filter-strip` rule)
 *
 * Drop-in for the old `<div className="flex flex-wrap items-center gap-2">`.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  right,
  className = "",
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "filter-strip flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:min-w-0",
        className,
      )}
    >
      {children}
      {right && <div className="flex items-center gap-2 sm:ml-auto">{right}</div>}
    </div>
  );
}
