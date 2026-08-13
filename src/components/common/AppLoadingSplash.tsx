import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";

/**
 * Shared branded full-screen loading splash. Mirrors the visual language of
 * ClinicManagerSplash so every authenticated surface (super admin, app home,
 * authenticated layout) shows a consistent loader instead of a bare
 * "Loading…" line.
 *
 * Uses a delayed-show pattern: only renders after `delayMs` (default 150 ms)
 * so cached / fast renders never flash. Pass `delayMs={0}` to render
 * immediately.
 */
export function AppLoadingSplash({
  title = "ClinicFlow",
  message = "Loading…",
  icon: Icon = Stethoscope,
  badgeIcon: BadgeIcon = ShieldCheck,
  delayMs = 150,
}: {
  title?: string;
  message?: string;
  icon?: LucideIcon;
  badgeIcon?: LucideIcon;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20">
            <Icon className="size-8" />
          </span>
          <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground ring-2 ring-background">
            <BadgeIcon className="size-3.5" />
          </span>
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
