/**
 * Appointment dialogs shared by DashboardSection and AppointmentsSection.
 *
 * Exports:
 *  - `AppointmentDetailSheet`  — read-only right-side sheet (patient details).
 *  - `AppointmentEditDialog`   — create + edit dialog with slot validation.
 *  - `validateAppointmentSlot` — pure helper used by the edit dialog.
 *  - `SlotValidationAlert`     — renders the validation feedback box.
 *
 * Why these live together: both dialogs are referenced by two different
 * sections, and the validation helper is consumed by the edit dialog only.
 * Keeping them in one file avoids deep import chains.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar,
  Mail,
  Pencil,
  Phone,
  Stethoscope,
  StickyNote,
  Trash2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  formatRange12,
  formatTime12,
  utcToZonedParts,
  zonedWallTimeToUtc,
} from "@/lib/clinic-time";
import {
  generateDoctorSlots,
  WEEKDAY_LABELS as DOCTOR_WEEKDAY_LABELS,
  type Override as DoctorOverride,
  type Schedule as DoctorSchedule,
} from "@/lib/doctor-slots";

import { Field, Grid, TextAreaField } from "../shared/FormPrimitives";
import {
  LIMITS,
  formatServerError,
  validateAppointmentPatient,
} from "@/lib/validation/clinic-forms";
import { formatNice } from "../shared/tz-format";
import { APPT_STATUSES, type AppointmentRow, type DashboardDoctor } from "../types";

// ============================================================================
// Slot validation: does the picked datetime fit the doctor's hours + time off?
// ============================================================================

export type SlotValidation =
  | { ok: true }
  | {
      ok: false;
      kind: "invalid" | "weekday" | "hours" | "timeoff-full" | "timeoff-partial";
      title: string;
      detail: string;
      /** Human-readable window we conflicted with, eg. "2:00 PM – 4:00 PM". */
      conflict?: string;
      /** Acceptable windows for context, eg. "9:00 AM – 1:00 PM". */
      allowed?: string;
    };

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function validateAppointmentSlot(args: {
  /** "YYYY-MM-DDTHH:mm" — interpreted in clinic timezone. */
  localValue: string;
  tz: string;
  schedules: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>;
  overrides: Array<{
    date: string;
    start_time: string | null;
    end_time: string | null;
    is_blocked: boolean;
  }>;
}): SlotValidation {
  const m = args.localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    return {
      ok: false,
      kind: "invalid",
      title: "Invalid date",
      detail: "Pick a valid date and time.",
    };
  }
  const [, ys, mos, ds, hs, mins] = m;
  const h = +hs;
  const mi = +mins;
  const dateKey = `${ys}-${mos}-${ds}`;

  // Weekday in the clinic's timezone for the picked clinic-local date.
  const probe = zonedWallTimeToUtc(dateKey, "12:00", args.tz);
  const weekday = utcToZonedParts(probe, args.tz).weekday;
  const minOfDay = h * 60 + mi;
  const toMin = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };
  const range = (a: string, b: string) => formatRange12(a.slice(0, 5), b.slice(0, 5));
  const pickedTime = formatTime12(`${hs}:${mins}`);

  const todays = args.overrides.filter((o) => o.date === dateKey && o.is_blocked);

  // 1) Full-day time off.
  if (todays.some((o) => !o.start_time && !o.end_time)) {
    return {
      ok: false,
      kind: "timeoff-full",
      title: "Doctor is off all day",
      detail: `${WEEKDAY_NAMES[weekday]}, ${dateKey} is marked as time off.`,
    };
  }

  // 2) Partial time-off window.
  for (const o of todays) {
    if (!o.start_time || !o.end_time) continue;
    if (minOfDay >= toMin(o.start_time) && minOfDay < toMin(o.end_time)) {
      return {
        ok: false,
        kind: "timeoff-partial",
        title: "Inside a time-off block",
        detail: `Picked ${pickedTime} on ${dateKey}, but the doctor is unavailable during this window.`,
        conflict: range(o.start_time, o.end_time),
      };
    }
  }

  // 3) Weekday not worked at all.
  const dayScheds = args.schedules.filter((s) => s.weekday === weekday && s.is_active);
  if (dayScheds.length === 0) {
    return {
      ok: false,
      kind: "weekday",
      title: `Doctor does not work on ${WEEKDAY_NAMES[weekday]}`,
      detail: "Pick a different day, or add this weekday in the doctor's Working hours.",
    };
  }

  // 4) Inside the doctor's working windows for that weekday?
  const inside = dayScheds.some(
    (s) => minOfDay >= toMin(s.start_time) && minOfDay < toMin(s.end_time),
  );
  if (!inside) {
    const ranges = dayScheds.map((s) => range(s.start_time, s.end_time)).join(", ");
    return {
      ok: false,
      kind: "hours",
      title: "Outside doctor's working hours",
      detail: `Picked ${pickedTime} on ${WEEKDAY_NAMES[weekday]}, but the doctor is only available during the hours below.`,
      allowed: ranges,
    };
  }

  return { ok: true };
}

export function SlotValidationAlert({ v }: { v: SlotValidation }) {
  if (v.ok) return null;
  const labelByKind: Record<Exclude<SlotValidation, { ok: true }>["kind"], string> = {
    invalid: "Invalid input",
    weekday: "Weekday off",
    hours: "Working hours",
    "timeoff-full": "Time off",
    "timeoff-partial": "Time off",
  };
  return (
    <div
      role="alert"
      className="mt-2 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs"
    >
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-destructive/15 text-destructive">
        <AlertCircle className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            {labelByKind[v.kind]}
          </span>
          <span className="font-medium text-foreground">{v.title}</span>
        </div>
        <p className="mt-1 text-muted-foreground">{v.detail}</p>
        {v.conflict && (
          <p className="mt-1">
            <span className="text-muted-foreground">Blocked window: </span>
            <span className="font-mono text-foreground">{v.conflict}</span>
          </p>
        )}
        {v.allowed && (
          <p className="mt-1">
            <span className="text-muted-foreground">Available hours: </span>
            <span className="font-mono text-foreground">{v.allowed}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Read-only detail sheet (used when clicking an appointment row)
// ============================================================================

export function AppointmentDetailSheet({
  appointment,
  doctorName,
  tz,
  onClose,
  onEdit,
}: {
  appointment: AppointmentRow;
  doctorName: string;
  tz: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    confirmed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    completed: "border-primary/30 bg-primary/10 text-primary",
    cancelled: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    rescheduled: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  };

  const initials =
    appointment.patient_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  // Tiny inline helper to render labelled info rows.
  const infoRow = (icon: React.ReactNode, label: string, value: string | null | undefined) => (
    <div className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-muted/30">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-muted to-muted/40 text-muted-foreground ring-1 ring-border/60">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium">{value ?? "—"}</p>
      </div>
    </div>
  );

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Patient details</SheetTitle>
          <SheetDescription>Appointment information at a glance.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-semibold text-primary ring-1 ring-primary/20">
              {initials}
            </span>
            <div>
              <p className="font-display text-lg font-semibold">{appointment.patient_name}</p>
              <span
                className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                  statusColors[appointment.status] ?? "border-border bg-muted"
                }`}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {appointment.status}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-0.5">
            {infoRow(<Phone className="size-4" />, "Phone", appointment.patient_phone)}
            {infoRow(<Mail className="size-4" />, "Email", appointment.patient_email)}
            {infoRow(
              <Calendar className="size-4" />,
              "Scheduled",
              formatNice(appointment.scheduled_at, tz),
            )}
            {infoRow(<Stethoscope className="size-4" />, "Doctor", doctorName)}
          </div>

          <Separator />

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <StickyNote className="size-3.5" /> Notes
            </div>
            {appointment.notes ? (
              <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm leading-relaxed">
                {appointment.notes}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No notes added.</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1" onClick={onEdit}>
            <Pencil className="mr-2 size-4" /> Edit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Create/edit appointment dialog (with live slot validation)
// ============================================================================

export function AppointmentEditDialog({
  clinicId,
  tz,
  appointment,
  doctors,
  onClose,
}: {
  clinicId: string;
  tz: string;
  /** null = create mode. */
  appointment: AppointmentRow | null;
  doctors: DashboardDoctor[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isCreate = appointment === null;

  // --- Seed the datetime field in clinic-local format --------------------
  const localValue = useMemo(() => {
    if (appointment) {
      const p = utcToZonedParts(new Date(appointment.scheduled_at), tz);
      return `${p.date}T${p.time}`;
    }
    // Default new appointments to the next round hour.
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const p = utcToZonedParts(now, tz);
    return `${p.date}T${p.time}`;
  }, [appointment, tz]);

  const [form, setForm] = useState({
    status: appointment?.status ?? "pending",
    doctor_id: appointment?.doctor_id ?? doctors[0]?.id ?? "",
    scheduled_at: localValue,
    notes: appointment?.notes ?? "",
    patient_name: appointment?.patient_name ?? "",
    patient_phone: appointment?.patient_phone ?? "",
    patient_email: appointment?.patient_email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const { [key as string]: _drop, ...rest } = e;
        return rest;
      });
    }
  }

  // --- Load doctor's schedule + time-off so we can validate the picked slot
  const { data: avail, isLoading: availLoading } = useQuery({
    queryKey: ["doctor-availability", form.doctor_id],
    queryFn: async () => {
      const [s, o] = await Promise.all([
        supabase
          .from("doctor_schedules")
          .select("weekday, start_time, end_time, is_active")
          .eq("doctor_id", form.doctor_id),
        supabase
          .from("doctor_slot_overrides")
          .select("date, start_time, end_time, is_blocked")
          .eq("doctor_id", form.doctor_id),
      ]);
      if (s.error) throw s.error;
      if (o.error) throw o.error;
      return { schedules: s.data ?? [], overrides: o.data ?? [] };
    },
    enabled: !!form.doctor_id,
  });

  const validation = useMemo(() => {
    if (!avail) return { ok: true as const };
    return validateAppointmentSlot({
      localValue: form.scheduled_at,
      tz,
      schedules: avail.schedules as Array<{
        weekday: number;
        start_time: string;
        end_time: string;
        is_active: boolean;
      }>,
      overrides: avail.overrides,
    });
  }, [avail, form.scheduled_at, tz]);

  // --- Slot picker for the currently selected date + doctor --------------
  const selectedDoctor = doctors.find((d) => d.id === form.doctor_id);
  const intervalMinutes = selectedDoctor?.appointment_duration_minutes ?? 15;
  const [pickedDate, pickedTime] = form.scheduled_at.split("T");

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
    const opts = [...daySlots.startOptions];
    // Preserve the currently-stored time even if it no longer aligns with
    // the grid (legacy data, or the interval was changed after booking).
    if (pickedTime && !opts.includes(pickedTime)) opts.unshift(pickedTime);
    return opts;
  }, [daySlots, pickedTime]);

  const offGrid = !!daySlots && !daySlots.startOptions.includes(pickedTime);

  // --- Cache invalidation: shared (stats) + paginated (table) ------------
  function invalidate() {
    qc.invalidateQueries({ queryKey: ["mgr-appts", clinicId] });
    qc.invalidateQueries({ queryKey: ["mgr-appts-page", clinicId] });
  }

  // --- Save (create or update) -------------------------------------------
  async function onSave() {
    const v = validateAppointmentPatient({
      patient_name: form.patient_name,
      patient_phone: form.patient_phone,
      patient_email: form.patient_email,
      notes: form.notes,
    });
    if (!v.ok) {
      setErrors(v.errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    if (!form.doctor_id) {
      toast.error("Pick a doctor");
      return;
    }
    if (!validation.ok) {
      toast.error(validation.title, { description: validation.detail });
      return;
    }
    setSaving(true);
    try {
      const duration = intervalMinutes;
      const payload = {
        clinic_id: clinicId,
        status: form.status as (typeof APPT_STATUSES)[number],
        doctor_id: form.doctor_id,
        scheduled_at: (() => {
          // Convert clinic-local wall time → UTC ISO for storage.
          const m = form.scheduled_at.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
          if (!m) return new Date(form.scheduled_at).toISOString();
          return zonedWallTimeToUtc(m[1], m[2], tz).toISOString();
        })(),
        duration_minutes: duration,
        notes: form.notes || null,
        patient_name: form.patient_name,
        patient_phone: form.patient_phone,
        patient_email: form.patient_email || null,
      };

      if (isCreate) {
        const { error } = await supabase.from("appointments").insert(payload);
        if (error) throw error;
        toast.success("Appointment created");
      } else {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", appointment!.id);
        if (error) throw error;
        toast.success("Appointment updated");
      }
      invalidate();
      onClose();
    } catch (e) {
      toast.error(formatServerError(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  // --- Delete (edit mode only) -------------------------------------------
  async function onDelete() {
    if (!appointment) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
      if (error) throw error;
      toast.success("Appointment deleted");
      invalidate();
      onClose();
    } catch (e) {
      toast.error(formatServerError(e, "Failed to delete"));
    } finally {
      setDeleting(false);
    }
  }

  // --- Render -------------------------------------------------------------
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New appointment" : "Edit appointment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Grid>
            <Field
              label="Patient name"
              required
              maxLength={LIMITS.name.max}
              value={form.patient_name}
              onChange={(v) => setField("patient_name", v)}
              error={errors.patient_name}
            />
            <Field
              label="Phone"
              required
              inputMode="tel"
              maxLength={LIMITS.phone.max}
              value={form.patient_phone}
              onChange={(v) => setField("patient_phone", v)}
              error={errors.patient_phone}
            />
          </Grid>
          <Field
            label="Email"
            type="email"
            inputMode="email"
            maxLength={LIMITS.email.max}
            value={form.patient_email}
            onChange={(v) => setField("patient_email", v)}
            error={errors.patient_email}
          />

          <div>
            <Label>Doctor</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.doctor_id}
              onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <Grid>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={pickedDate ?? ""}
                onChange={(e) => {
                  const d = e.target.value;
                  setForm({
                    ...form,
                    scheduled_at: `${d}T${pickedTime ?? "09:00"}`,
                  });
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    scheduled_at: `${pickedDate}T${e.target.value}`,
                  })
                }
                aria-invalid={!validation.ok}
              >
                {timeOptions.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatTime12(t)}
                      {t === pickedTime && offGrid ? "  (off-grid)" : ""}
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
                    No slots available — every working hour is blocked by time off.
                  </p>
                )}
            </div>
          </Grid>

          <div>
            <Label>Status</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {APPT_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <SlotValidationAlert v={validation} />

          <TextAreaField
            label="Notes"
            rows={3}
            maxLength={LIMITS.notes.max}
            value={form.notes}
            onChange={(v) => setField("notes", v)}
            error={errors.notes}
          />
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          {!isCreate ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving || deleting}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the booking. The patient will not be notified.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving || availLoading || !validation.ok}>
              {saving ? "Saving…" : isCreate ? "Create" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
