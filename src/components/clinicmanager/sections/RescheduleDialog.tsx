/**
 * RescheduleDialog — focused dialog for moving an existing appointment to a
 * new slot (and optionally a different doctor).
 *
 * Reuses the slot validation, slot generation, and time conversion helpers
 * from the Edit dialog. Adds a client-side overlap check against the shared
 * appointments cache; the DB `appointments_no_overlap` GiST constraint is
 * the authoritative guard.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatTime12, utcToZonedParts, zonedWallTimeToUtc } from "@/lib/clinic-time";
import {
  generateDoctorSlots,
  WEEKDAY_LABELS as DOCTOR_WEEKDAY_LABELS,
  type Override as DoctorOverride,
  type Schedule as DoctorSchedule,
} from "@/lib/doctor-slots";
import { formatServerError } from "@/lib/validation/clinic-forms";

import {
  invalidateClinicAppointments,
  useClinicAppointments,
} from "../hooks/useClinicAppointments";
import type { AppointmentRow, DashboardDoctor } from "../types";
import {
  SlotValidationAlert,
  validateAppointmentSlot,
  type SlotValidation,
} from "./AppointmentDialogs";

export function RescheduleDialog({
  clinicId,
  tz,
  appointment,
  doctors,
  onClose,
}: {
  clinicId: string;
  tz: string;
  appointment: AppointmentRow;
  doctors: DashboardDoctor[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const apptsQ = useClinicAppointments(clinicId);

  // Seed form with the appointment's current values, expressed in the
  // clinic's local wall time so the date / time inputs read naturally.
  const initialLocal = useMemo(() => {
    const p = utcToZonedParts(new Date(appointment.scheduled_at), tz);
    return `${p.date}T${p.time}`;
  }, [appointment.scheduled_at, tz]);

  const [doctorId, setDoctorId] = useState<string>(appointment.doctor_id);
  const [localValue, setLocalValue] = useState<string>(initialLocal);
  const [saving, setSaving] = useState(false);

  const [pickedDate, pickedTime] = localValue.split("T");
  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const intervalMinutes = selectedDoctor?.appointment_duration_minutes ?? 15;

  // Load this doctor's weekly schedule + time-off overrides for validation.
  const { data: avail, isLoading: availLoading } = useQuery({
    queryKey: ["doctor-availability", doctorId],
    queryFn: async () => {
      const [s, o] = await Promise.all([
        supabase
          .from("doctor_schedules")
          .select("weekday, start_time, end_time, is_active")
          .eq("doctor_id", doctorId),
        supabase
          .from("doctor_slot_overrides")
          .select("date, start_time, end_time, is_blocked")
          .eq("doctor_id", doctorId),
      ]);
      if (s.error) throw s.error;
      if (o.error) throw o.error;
      return { schedules: s.data ?? [], overrides: o.data ?? [] };
    },
    enabled: !!doctorId,
  });

  const daySlots = useMemo(() => {
    if (!avail || !pickedDate) return null;
    return generateDoctorSlots({
      date: pickedDate,
      schedules: avail.schedules as DoctorSchedule[],
      overrides: avail.overrides as DoctorOverride[],
      intervalMinutes,
    });
  }, [avail, pickedDate, intervalMinutes]);

  const timeOptions = useMemo(() => {
    if (!daySlots) return [] as string[];
    return [...daySlots.startOptions];
  }, [daySlots]);

  // Hours / time-off / weekday validation (shared with Edit dialog).
  const scheduleValidation: SlotValidation = useMemo(() => {
    if (!avail) return { ok: true };
    return validateAppointmentSlot({
      localValue,
      tz,
      schedules: avail.schedules as Array<{
        weekday: number;
        start_time: string;
        end_time: string;
        is_active: boolean;
      }>,
      overrides: avail.overrides,
    });
  }, [avail, localValue, tz]);

  // Overlap check against in-cache appointments for the chosen doctor,
  // excluding this appointment and cancelled rows. Approximates each row's
  // duration with the doctor's interval — DB GiST constraint is authoritative.
  const overlapValidation: SlotValidation = useMemo(() => {
    if (!pickedDate || !pickedTime) return { ok: true };
    const newStart = zonedWallTimeToUtc(pickedDate, pickedTime, tz).getTime();
    const newEnd = newStart + intervalMinutes * 60_000;
    const all = apptsQ.data ?? [];
    const conflict = all.find((a) => {
      if (a.id === appointment.id) return false;
      if (a.doctor_id !== doctorId) return false;
      if (a.status === "cancelled") return false;
      const otherStart = new Date(a.scheduled_at).getTime();
      const otherEnd = otherStart + intervalMinutes * 60_000;
      return newStart < otherEnd && newEnd > otherStart;
    });
    if (!conflict) return { ok: true };
    const p = utcToZonedParts(new Date(conflict.scheduled_at), tz);
    return {
      ok: false,
      kind: "timeoff-partial",
      title: "Overlaps another appointment",
      detail: `${selectedDoctor?.name ?? "This doctor"} already has ${conflict.patient_name} booked at this time.`,
      conflict: `${formatTime12(p.time)} — ${conflict.patient_name}`,
    };
  }, [
    apptsQ.data,
    appointment.id,
    doctorId,
    pickedDate,
    pickedTime,
    tz,
    intervalMinutes,
    selectedDoctor?.name,
  ]);

  const validation: SlotValidation = !scheduleValidation.ok
    ? scheduleValidation
    : overlapValidation;

  const slotChanged = localValue !== initialLocal || doctorId !== appointment.doctor_id;

  async function onSave() {
    if (!validation.ok) {
      toast.error(validation.title, { description: validation.detail });
      return;
    }
    if (!slotChanged) {
      toast.info("Pick a new date, time, or doctor first.");
      return;
    }
    setSaving(true);
    try {
      const m = localValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      const iso = m
        ? zonedWallTimeToUtc(m[1], m[2], tz).toISOString()
        : new Date(localValue).toISOString();
      const { error } = await supabase
        .from("appointments")
        .update({
          scheduled_at: iso,
          doctor_id: doctorId,
          status: "rescheduled",
        })
        .eq("id", appointment.id);
      if (error) throw error;
      toast.success("Appointment rescheduled");
      invalidateClinicAppointments(qc, clinicId);
      onClose();
    } catch (e) {
      toast.error(formatServerError(e, "Failed to reschedule"));
    } finally {
      setSaving(false);
    }
  }

  const originalParts = utcToZonedParts(new Date(appointment.scheduled_at), tz);
  const originalLabel = `${originalParts.date} · ${formatTime12(originalParts.time)}`;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            Reschedule appointment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient summary (read-only) */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Patient
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {appointment.patient_name}
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {appointment.patient_phone}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Currently booked for{" "}
              <span className="font-medium text-foreground">{originalLabel}</span>
            </p>
          </div>

          <div>
            <Label>Doctor</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={pickedDate ?? ""}
                onChange={(e) => {
                  const d = e.target.value;
                  setLocalValue(`${d}T${pickedTime ?? "09:00"}`);
                }}
                aria-invalid={!validation.ok}
              />
            </div>
            <div>
              <Label>Time</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm disabled:opacity-50"
                value={pickedTime ?? ""}
                disabled={!daySlots || timeOptions.length === 0}
                onChange={(e) => setLocalValue(`${pickedDate}T${e.target.value}`)}
                aria-invalid={!validation.ok}
              >
                {timeOptions.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatTime12(t)}
                    </option>
                  ))
                )}
              </select>
              {availLoading && (
                <p className="mt-1 text-xs text-muted-foreground">Checking availability…</p>
              )}
              {!availLoading && daySlots && daySlots.dayOff && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDoctor?.name ?? "Doctor"} is not scheduled on{" "}
                  {DOCTOR_WEEKDAY_LABELS[daySlots.weekday]}s.
                </p>
              )}
              {!availLoading && daySlots && !daySlots.dayOff && daySlots.fullyBlocked && (
                <p className="mt-1 text-xs text-muted-foreground">On time off all day.</p>
              )}
              {!availLoading &&
                daySlots &&
                !daySlots.dayOff &&
                !daySlots.fullyBlocked &&
                daySlots.startOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No slots available — every working hour is blocked.
                  </p>
                )}
            </div>
          </div>

          <SlotValidationAlert v={validation} />

          <p className="text-xs text-muted-foreground">
            Saving will mark this appointment as <strong>Rescheduled</strong> and move it to the
            selected slot.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || availLoading || !validation.ok || !slotChanged}
          >
            {saving ? "Saving…" : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
