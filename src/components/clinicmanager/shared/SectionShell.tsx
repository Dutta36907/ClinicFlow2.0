/**
 * Visual scaffolding shared by every manager section.
 *
 * `SectionShell` renders the page header (title + description + right-side
 * actions slot) and wraps the body. `Card` is the rounded panel every
 * section uses for grouped content.
 *
 * Keep these dumb and presentational — no data fetching, no state.
 */

import type { ReactNode } from "react";

export function SectionShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Buttons or controls rendered on the right of the header. */
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <header className="section-header flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4">
        <div className="relative">
          <div className="absolute -left-3 top-1.5 hidden h-7 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40 sm:block" />
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** Rounded panel used inside sections. Accepts extra className for layout tweaks. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        "rounded-2xl border border-border bg-card p-6 shadow-[0_8px_32px_-20px_oklch(0.55_0.22_265/0.25)] " +
        className
      }
    >
      {children}
    </div>
  );
}
