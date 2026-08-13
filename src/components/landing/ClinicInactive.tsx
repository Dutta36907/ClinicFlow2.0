/**
 * Shown on both the public booking page and the clinic manager dashboard
 * when `clinics.is_active === false`. Asks the clinic to contact platform
 * support to activate the account.
 */
import { useState } from "react";
import { Phone, Mail, Copy, Check, PowerOff } from "lucide-react";
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

export function ClinicInactive({
  clinic,
  note,
}: {
  clinic: Pick<LandingClinic, "name" | "logo_url" | "slug"> & { slug?: string };
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const slug = clinic.slug ?? "";

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
    `Activate clinic: ${clinic.name}${slug ? ` (/${slug})` : ""}`,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        {/* Logo / initials */}
        <div className="flex justify-center">
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
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {clinic.name}
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="relative inline-flex size-2 rounded-full bg-slate-400" />
            </span>
            <PowerOff className="size-3.5" />
            Account inactive
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {note ??
              "This clinic isn't active right now. Please contact the platform administrator to enable the booking page."}
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
                Call admin
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {SUPPORT_PHONE}
              </p>
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
                Email admin
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {SUPPORT_EMAIL}
              </p>
            </div>
          </a>
        </div>

        {slug && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>Your clinic ID:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {slug}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={copySlug}
              aria-label="Copy clinic ID"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
