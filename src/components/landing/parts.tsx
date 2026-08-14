/**
 * Landing — small presentational pieces shared by tabs.
 */
import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 transition-all duration-200 group-hover:ring-primary/30 group-hover:scale-105">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {value}
        </p>
      </div>
    </a>
  );
}

export function EmptyTab({
  icon: Icon = Sparkles,
  title,
  text,
}: {
  icon?: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
