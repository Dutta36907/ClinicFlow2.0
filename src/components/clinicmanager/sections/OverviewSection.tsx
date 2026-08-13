/**
 * OverviewSection — the landing tile that greets the manager.
 *
 * Shows three stat cards (today / next 7 days / active doctors) and the
 * shareable public booking link with copy + open actions.
 *
 * Data: live count of appointments in the next 7 days. Refreshes via
 * React Query when other sections invalidate the same key.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarRange,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";

import { Card, SectionShell } from "../shared/SectionShell";
import { tzDateKey, tzDayStart } from "../shared/tz-format";
import type { DashboardClinic, DashboardDoctor } from "../types";
import { useClinicAppointments } from "../hooks/useClinicAppointments";

export function OverviewSection({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  // --- Data: shared hook (single source of truth) -------------------------
  const apptsQ = useClinicAppointments(clinic.id);
  const [copied, setCopied] = useState(false);

  // --- Derived stats -------------------------------------------------------
  const { todayCount, weekCount } = useMemo(() => {
    const all = apptsQ.data ?? [];
    const start = tzDayStart(clinic.timezone, 0);
    const end = tzDayStart(clinic.timezone, 7);
    const inWeek = all.filter((a) => {
      const t = new Date(a.scheduled_at);
      return t >= start && t < end;
    });
    const todayKey = tzDateKey(new Date().toISOString(), clinic.timezone);
    return {
      todayCount: inWeek.filter(
        (a) => tzDateKey(a.scheduled_at, clinic.timezone) === todayKey,
      ).length,
      weekCount: inWeek.length,
    };
  }, [apptsQ.data, clinic.timezone]);
  const activeDoctors = doctors.filter((d) => d.is_active).length;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = `${origin}/${clinic.slug}`;

  const copy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Booking link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  // --- Render --------------------------------------------------------------
  return (
    <SectionShell
      title={`Welcome to ${clinic.name}`}
      description="Your clinic at a glance."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Today"
          value={todayCount}
          caption="appointments scheduled"
          icon={CalendarDays}
          tone="primary"
          loading={apptsQ.isLoading}
        />
        <StatTile
          label="Next 7 days"
          value={weekCount}
          caption="upcoming this week"
          icon={CalendarRange}
          tone="info"
          loading={apptsQ.isLoading}
        />
        <StatTile
          label="Active doctors"
          value={activeDoctors}
          caption="taking bookings"
          icon={Stethoscope}
          tone="success"
        />
      </div>

      <Card className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/5 blur-3xl"
        />
        <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="size-3.5 text-primary" /> Share booking link
        </div>
        <p className="relative mt-2 text-sm text-muted-foreground">
          Send this link to patients — they can book in under a minute, no account required.
        </p>
        <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-xl border border-border bg-muted/50 px-3 py-2.5">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-sm text-foreground">{bookingUrl}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copy}
              className="gap-1.5"
              aria-label="Copy booking link"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[color:var(--success,oklch(0.55_0.14_155))]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy
                </>
              )}
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Open
              </a>
            </Button>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}
