/**
 * AppointmentsSection — the full management list of appointments.
 *
 * Filter by status, doctor, date range, and free-text patient search.
 * Add / edit / delete via the shared dialogs in `./AppointmentDialogs.tsx`.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { invalidateClinicAppointments } from "../hooks/useClinicAppointments";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Card, SectionShell } from "../shared/SectionShell";
import { FilterBar } from "../shared/FilterBar";
import { formatInTz, tzDayStart } from "../shared/tz-format";
import {
  APPT_STATUSES,
  type AppointmentRow,
  type DashboardClinic,
  type DashboardDoctor,
} from "../types";
import { AppointmentEditDialog } from "./AppointmentDialogs";
import { RescheduleDialog } from "./RescheduleDialog";

type ApptStatusFilter = "all" | (typeof APPT_STATUSES)[number];
type ApptDateFilter = "all" | "today" | "7d" | "30d" | "past";

const PAGE_SIZE = 25;

export function AppointmentsSection({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  // --- Filter / UI state -------------------------------------------------
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<ApptStatusFilter>("all");
  const [doctorF, setDoctorF] = useState<string>("all");
  const [dateF, setDateF] = useState<ApptDateFilter>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [rescheduling, setRescheduling] = useState<AppointmentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AppointmentRow | null>(null);
  const qc = useQueryClient();

  // Reset to page 1 on any filter / search change.
  useEffect(() => {
    setPage(1);
  }, [search, statusF, doctorF, dateF]);

  // --- Server-paginated query (max PAGE_SIZE rows per fetch) -------------
  const tz = clinic.timezone;
  const dateBounds = useMemo(() => {
    if (dateF === "today")
      return { gte: tzDayStart(tz, 0).toISOString(), lt: tzDayStart(tz, 1).toISOString() };
    if (dateF === "7d")
      return { gte: tzDayStart(tz, 0).toISOString(), lt: tzDayStart(tz, 7).toISOString() };
    if (dateF === "30d")
      return { gte: tzDayStart(tz, 0).toISOString(), lt: tzDayStart(tz, 30).toISOString() };
    if (dateF === "past")
      return { lt: new Date().toISOString() };
    return null;
  }, [dateF, tz]);

  const apptsQ = useQuery({
    queryKey: [
      "mgr-appts-page",
      clinic.id,
      { page, statusF, doctorF, dateF, search: search.trim().toLowerCase() },
    ],
    enabled: !!clinic.id,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("appointments")
        .select(
          "id, patient_name, patient_phone, patient_email, scheduled_at, status, doctor_id, notes, created_at",
          { count: "exact" },
        )
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("scheduled_at", { ascending: false });
      if (statusF !== "all") q = q.eq("status", statusF);
      if (doctorF !== "all") q = q.eq("doctor_id", doctorF);
      if (dateBounds?.gte) q = q.gte("scheduled_at", dateBounds.gte);
      if (dateBounds?.lt) q = q.lt("scheduled_at", dateBounds.lt);
      const s = search.trim();
      if (s) {
        const esc = s.replace(/[%,]/g, " ");
        q = q.or(
          `patient_name.ilike.%${esc}%,patient_phone.ilike.%${esc}%,patient_email.ilike.%${esc}%`,
        );
      }
      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AppointmentRow[], total: count ?? 0 };
    },
  });

  const rows = apptsQ.data?.rows ?? [];
  const total = apptsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const doctorMap = useMemo(
    () => Object.fromEntries(doctors.map((d) => [d.id, d.name])),
    [doctors],
  );



  async function deleteAppt(a: AppointmentRow) {
    const { error } = await supabase.from("appointments").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Appointment deleted");
    invalidateClinicAppointments(qc, clinic.id);
    qc.invalidateQueries({ queryKey: ["mgr-appts-page", clinic.id] });
    setConfirmDelete(null);
  }



  return (
    <SectionShell
      title="Appointments"
      description="All bookings for this clinic. Add, edit, or remove appointments."
      actions={
        <Button onClick={() => setCreating(true)} disabled={doctors.length === 0}>
          <Plus className="size-4" /> Add appointment
        </Button>
      }
    >
      {/* Filter strip */}
      <FilterBar
        right={
          <span className="text-xs tabular-nums text-muted-foreground">
            {total} {total === 1 ? "appointment" : "appointments"}
          </span>

        }
      >
        <Input
          placeholder="Search patient, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full sm:w-64"
          aria-label="Search appointments"
        />
        <Select value={statusF} onValueChange={(v) => setStatusF(v as ApptStatusFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[150px] capitalize" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={doctorF} onValueChange={(v) => setDoctorF(v)}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]" aria-label="Filter by doctor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateF} onValueChange={(v) => setDateF(v as ApptDateFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Filter by date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Next 7 days</SelectItem>
            <SelectItem value="30d">Next 30 days</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden p-0">
        <div className="-mx-4 sm:mx-0 overflow-x-auto" data-slot="table-container">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apptsQ.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="mt-1.5 h-3 w-36" />
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-8 w-20 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}
              {!apptsQ.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={CalendarPlus}
                      title="No appointments match"
                      description="Try clearing a filter, or add the first appointment to get going."
                      action={
                        <Button
                          size="sm"
                          onClick={() => setCreating(true)}
                          disabled={doctors.length === 0}
                        >
                          <Plus className="size-4" /> Add appointment
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((a) => {
                const initials = a.patient_name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("") || "?";
                const date = formatInTz(a.scheduled_at, clinic.timezone, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const time = formatInTz(a.scheduled_at, clinic.timezone, {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                return (
                  <TableRow key={a.id} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="text-sm">
                      <div className="font-medium tabular-nums">{date}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">{time}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/15">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.patient_name}</div>
                          {a.patient_email && (
                            <div className="truncate text-xs text-muted-foreground">
                              {a.patient_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{a.patient_phone}</TableCell>
                    <TableCell className="text-sm">
                      {doctorMap[a.doctor_id] ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        {a.status !== "completed" && a.status !== "cancelled" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRescheduling(a)}
                            aria-label={`Reschedule ${a.patient_name}'s appointment`}
                            title="Reschedule"
                            className="min-h-10 min-w-10 hover:bg-primary/10"
                          >
                            <CalendarClock className="size-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(a)}
                          aria-label={`Edit ${a.patient_name}'s appointment`}
                          className="min-h-10 min-w-10 hover:bg-primary/10"
                        >
                          <Pencil className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(a)}
                          aria-label={`Delete ${a.patient_name}'s appointment`}
                          className="min-h-10 min-w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2.5 text-xs">
          <div className="text-muted-foreground tabular-nums">
            {total === 0
              ? "No results"
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-1 text-muted-foreground tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>


      {(editing || creating) && (
        <AppointmentEditDialog
          clinicId={clinic.id}
          tz={clinic.timezone || "UTC"}
          appointment={editing}
          doctors={doctors}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {rescheduling && (
        <RescheduleDialog
          clinicId={clinic.id}
          tz={clinic.timezone || "UTC"}
          appointment={rescheduling}
          doctors={doctors}
          onClose={() => setRescheduling(null)}
        />
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the booking. The patient will not be
              notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteAppt(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}
