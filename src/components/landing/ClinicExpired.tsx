/**
 * Shown on both the public booking page and the clinic manager dashboard
 * when `clinics.expires_at` is in the past. Distinct from `ClinicInactive`:
 * this is a renewal-themed dead-end, not an activation-pending state.
 */
import { useState } from "react";
import {
  Phone,
  Mail,
  Copy,
  Check,
  CalendarX,
  CalendarCheck,
  LayoutDashboard,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUPPORT_PHONE, SUPPORT_EMAIL } from "@/lib/support-contact";
import type { LandingClinic } from "./ClinicLanding";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export function ClinicExpired({
  clinic,
  expiresAt,
  note,
}: {
  clinic: Pick<LandingClinic, "name" | "logo_url" | "slug"> & { slug?: string };
  expiresAt?: string | null;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const slug = clinic.slug ?? "";
  const expiredOn = formatDate(expiresAt);

  async function copySlug() {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const mailtoSubject = encodeURIComponent(
    `Renew clinic: ${clinic.name}${slug ? ` (/${slug})` : ""}`,
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-12">
      {/* Soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,theme(colors.amber.500/0.12),transparent_55%)]"
      />

      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-elegant">
        {/* Logo / initials */}
        <div className="flex justify-center">
          <div className="relative">
            {clinic.logo_url ? (
              <img
                src={clinic.logo_url}
                alt={clinic.name}
                className="size-16 rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted text-xl font-semibold text-foreground">
                {initials(clinic.name) || "?"}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-card bg-amber-500 text-white shadow">
              <CalendarX className="size-3.5" />
            </span>
          </div>
        </div>

        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/60" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            Subscription expired
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            Your subscription has expired
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{clinic.name}</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {note ??
              `Online bookings and the manager dashboard are paused${expiredOn ? ` since ${expiredOn}` : ""}. Renew with the platform admin to bring everything back online.`}
          </p>
        </div>

        {/* Contact tiles */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-xl border border-border bg-background p-4 transition",
              "hover:border-primary hover:bg-primary/5",
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Phone className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Renew — call admin
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{SUPPORT_PHONE}</p>
            </div>
          </a>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${mailtoSubject}`}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-xl border border-border bg-background p-4 transition",
              "hover:border-primary hover:bg-primary/5",
            )}
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email to renew
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {SUPPORT_EMAIL}
              </p>
            </div>
          </a>
        </div>

        {/* What you get back */}
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Restored when you renew
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { icon: CalendarCheck, label: "Online bookings" },
              { icon: LayoutDashboard, label: "Manager dashboard" },
              { icon: BellRing, label: "Patient notifications" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {slug && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>Your clinic ID:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{slug}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={copySlug}
              aria-label="Copy clinic ID"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
