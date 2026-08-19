/**
 * DashboardSection — the operational home screen.
 *
 * Shows a stat strip, the next upcoming appointment, the shareable
 * booking URL, and a filterable list of appointments. Clicking a row
 * opens the read-only detail sheet; the edit pencil opens the edit
 * dialog.
 *
 * Both dialogs come from `./AppointmentDialogs.tsx` so they can be
 * reused by `AppointmentsSection`.
 */

import { useMemo, useState } from "react";
import { useClinicAppointments } from "../hooks/useClinicAppointments";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Clock,
  Link2,
  Pencil,
  Stethoscope,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Card, SectionShell } from "../shared/SectionShell";
import { formatInTz, formatNice, tzDateKey, tzDayStart } from "../shared/tz-format";
import type { AppointmentRow, DashboardClinic, DashboardDoctor } from "../types";
import { AppointmentDetailSheet, AppointmentEditDialog } from "./AppointmentDialogs";

// --- Local filter / range types --------------------------------------------

type RangeKey = "today" | "7d" | "30d" | "past" | "all";
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Next 7 days", days: 7 },
  { key: "30d", label: "Next 30 days", days: 30 },
  { key: "past", label: "Past", days: 0 },
  { key: "all", label: "All time", days: 0 },
];

type StatusFilter = "all" | "pending" | "confirmed" | "completed";

// ============================================================================
// Section
// ============================================================================

export function DashboardSection({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  // --- Local UI state ----------------------------------------------------
  const [range, setRange] = useState<RangeKey>("7d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAppt, setSelectedAppt] = useState<AppointmentRow | null>(null);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);

  const days = RANGES.find((r) => r.key === range)!.days;

  // --- Data fetching: shared hook (single source of truth) ----------------
  const apptsQ = useClinicAppointments(clinic.id);
  const allAppts = useMemo<AppointmentRow[]>(() => apptsQ.data ?? [], [apptsQ.data]);

  // --- Derived data ------------------------------------------------------
  const doctorMap = useMemo(
    () => Object.fromEntries(doctors.map((d) => [d.id, d.name])),
    [doctors],
  );

  // Apply the dashboard's range filter client-side over the shared dataset
  // so stats and the table always match the Appointments tab counts.
  const inRange = useMemo<AppointmentRow[]>(() => {
    const todayStart = tzDayStart(clinic.timezone, 0);
    if (range === "past") {
      return allAppts
        .filter((a) => new Date(a.scheduled_at) < todayStart)
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    }
    if (range === "all") {
      return [...allAppts].sort(
        (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
      );
    }
    const end = tzDayStart(clinic.timezone, days);
    return allAppts
      .filter((a) => {
        const t = new Date(a.scheduled_at);
        return t >= todayStart && t < end;
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [allAppts, range, days, clinic.timezone]);

  const all = inRange;
  const todayKey = tzDateKey(new Date().toISOString(), clinic.timezone);
  const todayCount = all.filter(
    (a) => tzDateKey(a.scheduled_at, clinic.timezone) === todayKey && a.status !== "cancelled",
  ).length;
  const pendingCount = all.filter((a) => a.status === "pending").length;
  const confirmedCount = all.filter((a) => a.status === "confirmed").length;
  const activeDoctors = doctors.filter((d) => d.is_active).length;
  const nowMs = Date.now();
  const nextAppt = all.find(
    (a) => new Date(a.scheduled_at).getTime() >= nowMs && a.status !== "cancelled",
  );

  const filtered = statusFilter === "all" ? all : all.filter((a) => a.status === statusFilter);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = `${origin}/${clinic.slug}`;

  // --- Render -------------------------------------------------------------
  return (
    <SectionShell
      title="Dashboard"
      description="Everything you need to run today's clinic, in one place."
      actions={
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                "focus-pill rounded-md px-3 py-1.5 text-xs font-medium transition " +
                (range === r.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={todayCount}
          caption="scheduled today"
          icon={CalendarDays}
          tone="primary"
          loading={apptsQ.isLoading}
        />
        <StatTile
          label="Pending"
          value={pendingCount}
          caption="awaiting confirmation"
          icon={CircleDashed}
          tone="warning"
          loading={apptsQ.isLoading}
        />
        <StatTile
          label="Confirmed"
          value={confirmedCount}
          caption="ready to go"
          icon={CircleCheck}
          tone="success"
          loading={apptsQ.isLoading}
        />
        <StatTile
          label="Active doctors"
          value={activeDoctors}
          caption="taking bookings"
          icon={Stethoscope}
          tone="info"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="size-3.5" /> Next appointment
          </div>
          {nextAppt ? (
            <button
              onClick={() => setEditing(nextAppt)}
              className="mt-3 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4 text-left transition hover:bg-muted"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-semibold">
                  {nextAppt.patient_name}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {doctorMap[nextAppt.doctor_id] ?? "—"} ·{" "}
                  {formatNice(nextAppt.scheduled_at, clinic.timezone)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={nextAppt.status} />
                <Pencil className="size-4 text-muted-foreground" />
              </div>
            </button>
          ) : (
            <p className="mt-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              No upcoming appointments in this range.
            </p>
          )}
        </Card>

        <Card className="relative overflow-hidden">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/5 blur-2xl"
          />
          <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3.5 text-primary" /> Booking link
          </div>
          <div className="relative mt-3 flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted/50 px-2.5 py-2">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-mono text-xs">{bookingUrl}</span>
          </div>
          <div className="relative mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success("Copied to clipboard");
              }}
            >
              <Link2 className="size-3.5" />
              Copy
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Upcoming appointments</h2>
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["all", "pending", "confirmed", "completed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                "focus-pill rounded-md px-3 py-1.5 text-xs font-medium capitalize transition " +
                (statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="-mx-4 sm:mx-0 overflow-x-auto" data-slot="table-container">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apptsQ.isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-1.5 h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto size-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}
              {!apptsQ.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={CalendarDays}
                      title="No appointments yet"
                      description="When patients book through your public link, they'll appear here."
                    />
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelectedAppt(a)}>
                  <TableCell>
                    <div className="font-medium">{a.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.patient_phone}
                      {a.patient_email ? ` · ${a.patient_email}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{doctorMap[a.doctor_id] ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {formatInTz(a.scheduled_at, clinic.timezone, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${a.patient_name}'s appointment`}
                      className="ml-auto min-h-10 min-w-10"
                      onClick={(e) => {
                        // Don't trigger the row's onClick → detail sheet.
                        e.stopPropagation();
                        setEditing(a);
                      }}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedAppt && (
        <AppointmentDetailSheet
          appointment={selectedAppt}
          doctorName={doctorMap[selectedAppt.doctor_id] ?? "—"}
          tz={clinic.timezone}
          onClose={() => setSelectedAppt(null)}
          onEdit={() => {
            setEditing(selectedAppt);
            setSelectedAppt(null);
          }}
        />
      )}

      {editing && (
        <AppointmentEditDialog
          clinicId={clinic.id}
          tz={clinic.timezone || "UTC"}
          appointment={editing}
          doctors={doctors}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionShell>
  );
}
