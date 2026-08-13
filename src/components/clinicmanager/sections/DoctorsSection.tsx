/**
 * DoctorsSection — full CRUD for the clinic's doctors.
 *
 * Composed of three internal pieces (kept in this one file because they
 * are only meaningful together):
 *
 *  1. `DoctorsSection`     — table + "Add doctor" button.
 *  2. `DoctorDialog`       — create/edit doctor profile + tabs for hours
 *                            and time off.
 *  3. `WorkingHoursEditor` — per-doctor weekly availability.
 *  4. `TimeOffEditor`      — per-doctor day or partial-day blackouts.
 *
 * Booking-slot generation reads the doctor's hours + overrides — see
 * `src/lib/doctor-slots.ts` for the slot math.
 */

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Award, ExternalLink, Pencil, Plus, Stethoscope, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

import { supabase } from "@/integrations/supabase/client";
import { MediaLibraryDialog } from "../shared/MediaLibraryDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteDoctor, upsertDoctor } from "@/lib/clinicmanager.functions";
import { formatRange12, formatTime12 } from "@/lib/clinic-time";
import {
  generateDoctorSlots,
  WEEKDAY_LABELS as DOCTOR_WEEKDAY_LABELS,
  type Schedule as DoctorSchedule,
} from "@/lib/doctor-slots";

import { Card, SectionShell } from "../shared/SectionShell";
import { Field, Grid, TextAreaField } from "../shared/FormPrimitives";
import {
  DAY_KEYS,
  DAY_LABELS,
  clinicHoursToSchedule,
  type DaySchedule,
} from "../shared/days";
import type { DashboardClinic, DashboardDoctor } from "../types";
import {
  LIMITS,
  formatServerError,
  validateDoctorForm,
} from "@/lib/validation/clinic-forms";

// ============================================================================
// Top-level: list of doctors + Add button
// ============================================================================

export function DoctorsSection({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  /** `null` = closed, `"new"` = create, `DashboardDoctor` = edit. */
  const [editing, setEditing] = useState<DashboardDoctor | "new" | null>(null);

  return (
    <SectionShell
      title="Doctors"
      description="Add and manage doctors patients can book."
      actions={
        <Button onClick={() => setEditing("new")} className="gap-2 shadow-sm">
          <Plus className="size-4" /> Add doctor
        </Button>
      }
    >
      <Card className="overflow-hidden p-0">
        <div className="-mx-4 sm:mx-0 overflow-x-auto">
          <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Stethoscope}
                    title="No doctors yet"
                    description="Add your first doctor so patients can start booking."
                  />
                </TableCell>
              </TableRow>
            )}
            {doctors.map((d) => (
              <TableRow
                key={d.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => setEditing(d)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    {d.photo_url ? (
                      <img
                        src={d.photo_url}
                        alt={d.name}
                        className="size-9 rounded-full object-cover ring-2 ring-background"
                      />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary ring-1 ring-primary/15">
                        {d.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.name}</div>
                      {d.degree && (
                        <div className="truncate text-xs text-muted-foreground">
                          {d.degree}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.specialization ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {d.years_experience != null ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Award className="size-3.5" />
                      {d.years_experience} yrs
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                      (d.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground")
                    }
                  >
                    <span className={"size-1.5 rounded-full " + (d.is_active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    {d.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      aria-label={`View ${d.name} profile`}
                      className="hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        to="/$slug_/clinicmanager/doctors/$doctorId"
                        params={{ slug: clinic.slug, doctorId: d.id }}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${d.name}`}
                      className="hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(d);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      {editing && (
        <DoctorDialog
          clinic={clinic}
          doctor={editing === "new" ? null : editing}
          open={!!editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionShell>
  );
}

// ============================================================================
// Create / edit doctor dialog (profile, weekly hours, time off)
// ============================================================================

function DoctorDialog({
  clinic,
  doctor,
  open,
  onClose,
}: {
  clinic: DashboardClinic;
  /** `null` when creating a new doctor. */
  doctor: DashboardDoctor | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(upsertDoctor);
  const remove = useServerFn(deleteDoctor);

  const [form, setForm] = useState({
    name: doctor?.name ?? "",
    specialization: doctor?.specialization ?? "",
    degree: doctor?.degree ?? "",
    years_experience: doctor?.years_experience?.toString() ?? "",
    description: doctor?.description ?? "",
    photo_url: doctor?.photo_url ?? "",
    is_active: doctor?.is_active ?? true,
    specialties: (doctor?.specialties ?? []).join(", "),
    languages: (doctor?.languages ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Update a single field and clear that field's error (if any). */
  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const { [key as string]: _drop, ...rest } = e;
        return rest;
      });
    }
  }

  // --- Save (create or update) -------------------------------------------
  async function onSubmit() {
    // Client-side validation first — block before hitting the server.
    const v = validateDoctorForm({
      name: form.name,
      specialization: form.specialization,
      degree: form.degree,
      years_experience: form.years_experience,
      description: form.description,
      photo_url: form.photo_url,
      specialties: form.specialties,
      languages: form.languages,
    });
    if (!v.ok) {
      setErrors(v.errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const splitTags = (raw: string) =>
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      const result = await save({
        data: {
          id: doctor?.id,
          clinic_id: clinic.id,
          name: form.name.trim(),
          specialization: form.specialization.trim(),
          degree: form.degree.trim(),
          years_experience: form.years_experience
            ? parseInt(form.years_experience, 10)
            : null,
          description: form.description.trim(),
          photo_url: form.photo_url.trim(),
          is_active: form.is_active,
          specialties: splitTags(form.specialties),
          languages: splitTags(form.languages),
        },
      });

      // For new doctors, seed weekly schedule from clinic open hours so
      // managers don't have to re-enter the same hours from scratch.
      if (!doctor && result?.id) {
        const seed = clinicHoursToSchedule(clinic.working_hours);
        const rows = seed
          .map((s, idx) => ({
            doctor_id: result.id,
            weekday: idx,
            start_time: s.start,
            end_time: s.end,
            is_active: s.active,
          }))
          .filter((r) => r.is_active);
        if (rows.length > 0) {
          await supabase.from("doctor_schedules").insert(rows);
        }
      }

      toast.success(doctor ? "Doctor updated" : "Doctor added");
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
      onClose();
    } catch (e) {
      toast.error(formatServerError(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  // --- Delete -------------------------------------------------------------
  async function onDelete() {
    if (!doctor) return;
    try {
      await remove({ data: { id: doctor.id, clinic_id: clinic.id } });
      toast.success("Doctor removed");
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  // --- Render -------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doctor ? "Edit doctor" : "Add doctor"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              Profile
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex-1" disabled={!doctor}>
              Working hours
            </TabsTrigger>
            <TabsTrigger value="timeoff" className="flex-1" disabled={!doctor}>
              Time off
            </TabsTrigger>
          </TabsList>

          {/* Profile tab */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            <Field
              label="Name"
              required
              maxLength={LIMITS.name.max}
              value={form.name}
              onChange={(v) => setField("name", v)}
              error={errors.name}
            />
            <Grid>
              <Field
                label="Specialization"
                maxLength={LIMITS.specialization.max}
                value={form.specialization}
                onChange={(v) => setField("specialization", v)}
                error={errors.specialization}
              />
              <Field
                label="Degree"
                maxLength={LIMITS.degree.max}
                value={form.degree}
                onChange={(v) => setField("degree", v)}
                error={errors.degree}
              />
              <Field
                label="Years of experience"
                inputMode="numeric"
                value={form.years_experience}
                onChange={(v) =>
                  // numeric-only — strip everything else
                  setField("years_experience", v.replace(/[^0-9]/g, ""))
                }
                error={errors.years_experience}
              />
            </Grid>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Photo</Label>
              <div className="flex items-start gap-3">
                {form.photo_url ? (
                  <img
                    src={form.photo_url}
                    alt=""
                    className="size-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="grid size-16 shrink-0 place-items-center rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
                    <Stethoscope className="size-6" />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <Input
                    type="url"
                    maxLength={LIMITS.url.max}
                    placeholder="Paste image URL or click Browse"
                    value={form.photo_url}
                    onChange={(e) => setField("photo_url", e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <MediaLibraryDialog
                      bucket="clinic-gallery"
                      clinicId={clinic.id}
                      label="Browse"
                      pickFromBuckets={["clinic-gallery", "clinic-logos"]}
                      recommendedHint="Square 512×512 works best"
                      onSelect={(url: string) => setField("photo_url", url)}
                    />
                    {form.photo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setField("photo_url", "")}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {errors.photo_url && (
                    <p className="text-xs text-destructive">{errors.photo_url}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Square photo works best (e.g. 512×512). JPEG, PNG or WebP — we shrink it for you.
                  </p>
                </div>
              </div>
            </div>
            <TextAreaField
              label="Description"
              rows={3}
              maxLength={LIMITS.description.max}
              value={form.description}
              onChange={(v) => setField("description", v)}
              error={errors.description}
            />
            <Grid>
              <Field
                label="Specialties"
                placeholder="Endodontics, Implants, Pediatric"
                value={form.specialties}
                onChange={(v) => setField("specialties", v)}
                error={errors.specialties}
              />
              <Field
                label="Languages spoken"
                placeholder="English, Hindi, Bengali"
                value={form.languages}
                onChange={(v) => setField("languages", v)}
                error={errors.languages}
              />
            </Grid>
            <p className="-mt-2 text-xs text-muted-foreground">
              Separate items with commas (max 12 each, 60 chars per item).
            </p>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive doctors are hidden from booking.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: c })}
              />
            </div>
            {!doctor && (
              <p className="text-xs text-muted-foreground">
                Weekly hours will be copied from your clinic hours. You can
                fine-tune them and add time off after the doctor is created.
              </p>
            )}
          </TabsContent>

          {/* Hours tab (only shown for saved doctors) */}
          <TabsContent value="hours" className="mt-4">
            {doctor && (
              <WorkingHoursEditor doctorId={doctor.id} clinic={clinic} />
            )}
          </TabsContent>

          {/* Time off tab (only shown for saved doctors) */}
          <TabsContent value="timeoff" className="mt-4">
            {doctor && (
              <TimeOffEditor
                doctorId={doctor.id}
                tz={clinic.timezone}
                intervalMinutes={doctor.appointment_duration_minutes}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="justify-between sm:justify-between">
          {doctor ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this doctor?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the doctor and their schedule. Existing
                    appointments stay.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>
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
            <Button
              onClick={onSubmit}
              disabled={saving}
            >
              {saving ? "Saving…" : doctor ? "Save profile" : "Add doctor"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Per-doctor weekly working hours
// ============================================================================

function WorkingHoursEditor({
  doctorId,
  clinic,
}: {
  doctorId: string;
  clinic: DashboardClinic;
}) {
  const qc = useQueryClient();

  // Load saved schedule, projected onto a Sun..Sat array.
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-schedules", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("weekday, start_time, end_time, is_active")
        .eq("doctor_id", doctorId);
      if (error) throw error;
      const rows: DaySchedule[] = DAY_KEYS.map(() => ({
        active: false,
        start: "09:00",
        end: "17:00",
      }));
      for (const r of data ?? []) {
        if (r.weekday >= 0 && r.weekday <= 6) {
          rows[r.weekday] = {
            active: r.is_active,
            // DB stores HH:mm:ss; we display HH:mm.
            start: (r.start_time as string).slice(0, 5),
            end: (r.end_time as string).slice(0, 5),
          };
        }
      }
      return rows;
    },
  });

  const [rows, setRows] = useState<DaySchedule[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed local editor once the query resolves.
  useEffect(() => {
    if (data && !rows) setRows(data);
  }, [data, rows]);

  if (isLoading || !rows) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  function setRow(i: number, patch: Partial<DaySchedule>) {
    setRows((rs) => rs!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function copyFromClinic() {
    setRows(clinicHoursToSchedule(clinic.working_hours));
  }

  // Save = wipe existing schedule rows for this doctor then insert active ones.
  async function onSave() {
    if (!rows) return;
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("doctor_schedules")
        .delete()
        .eq("doctor_id", doctorId);
      if (delErr) throw delErr;

      const inserts = rows
        .map((r, idx) => ({
          doctor_id: doctorId,
          weekday: idx,
          start_time: r.start,
          end_time: r.end,
          is_active: true,
        }))
        .filter((_, idx) => rows[idx].active);

      if (inserts.length > 0) {
        const { error: insErr } = await supabase
          .from("doctor_schedules")
          .insert(inserts);
        if (insErr) throw insErr;
      }
      toast.success("Hours saved");
      qc.invalidateQueries({ queryKey: ["doctor-schedules", doctorId] });
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          When this doctor is available for bookings each week.
        </p>
        <Button variant="outline" size="sm" onClick={copyFromClinic}>
          Copy from clinic hours
        </Button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-3 p-3"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={r.active}
                onCheckedChange={(c) => setRow(i, { active: c })}
              />
              <span className="w-12 text-sm font-medium">{DAY_LABELS[i]}</span>
            </div>
            {r.active ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={r.start}
                  onChange={(e) => setRow(i, { start: e.target.value })}
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-32"
                  value={r.end}
                  onChange={(e) => setRow(i, { end: e.target.value })}
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Off</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Per-doctor time-off (whole days or partial days)
// ============================================================================

type Override = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
  reason: string | null;
};

function TimeOffEditor({
  doctorId,
  tz,
  intervalMinutes,
}: {
  doctorId: string;
  tz: string;
  intervalMinutes: number;
}) {
  const qc = useQueryClient();

  // --- Local form state --------------------------------------------------
  const [showPast, setShowPast] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);

  // --- Data --------------------------------------------------------------
  const { data: overrides, isLoading } = useQuery({
    queryKey: ["doctor-overrides", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_slot_overrides")
        .select("id, date, start_time, end_time, is_blocked, reason")
        .eq("doctor_id", doctorId)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Override[];
    },
  });

  const { data: schedules } = useQuery({
    queryKey: ["doctor-schedules", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("weekday, start_time, end_time, is_active")
        .eq("doctor_id", doctorId);
      if (error) throw error;
      return (data ?? []) as DoctorSchedule[];
    },
  });

  // Slot grid for the picked date (partial mode only).
  const daySlots = useMemo(() => {
    if (mode !== "partial" || !startDate || !schedules) return null;
    return generateDoctorSlots({
      date: startDate,
      schedules,
      // We're CREATING new time-off, so ignore existing time-off when
      // building the candidate grid — the manager should be able to
      // pick any working slot.
      overrides: [],
      intervalMinutes,
    });
  }, [mode, startDate, schedules, intervalMinutes]);

  // Keep selected start/end times valid as date or schedule changes.
  useEffect(() => {
    if (!daySlots) return;
    if (daySlots.dayOff) return;
    if (daySlots.startOptions.length === 0) return;
    if (!daySlots.startOptions.includes(startTime)) {
      setStartTime(daySlots.startOptions[0]);
    }
  }, [daySlots, startTime]);

  useEffect(() => {
    if (!daySlots) return;
    const ends = daySlots.endOptionsFor(startTime);
    if (ends.length === 0) return;
    if (!ends.includes(endTime)) setEndTime(ends[0]);
  }, [daySlots, startTime, endTime]);

  // "Today" in clinic local time — used to hide past time-off by default.
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const visible = (overrides ?? []).filter(
    (o) => showPast || o.date >= todayKey,
  );

  // --- Add handler -------------------------------------------------------
  async function onAdd() {
    if (!startDate) {
      toast.error("Pick a date");
      return;
    }
    setAdding(true);
    try {
      const rows: Array<{
        doctor_id: string;
        date: string;
        start_time: string | null;
        end_time: string | null;
        is_blocked: boolean;
        reason: string | null;
      }> = [];

      if (mode === "full") {
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = endDate ? new Date(`${endDate}T00:00:00Z`) : start;
        if (end < start) {
          toast.error("End date must be after start date");
          setAdding(false);
          return;
        }
        // Expand date range into one row per day.
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          rows.push({
            doctor_id: doctorId,
            date: d.toISOString().slice(0, 10),
            start_time: null,
            end_time: null,
            is_blocked: true,
            reason: reason.trim() || null,
          });
        }
      } else {
        if (startTime >= endTime) {
          toast.error("End time must be after start time");
          setAdding(false);
          return;
        }
        rows.push({
          doctor_id: doctorId,
          date: startDate,
          start_time: startTime,
          end_time: endTime,
          is_blocked: true,
          reason: reason.trim() || null,
        });
      }

      const { error } = await supabase
        .from("doctor_slot_overrides")
        .insert(rows);
      if (error) throw error;
      toast.success("Time off added");
      setStartDate("");
      setEndDate("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["doctor-overrides", doctorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  // --- Remove handler ----------------------------------------------------
  async function onRemove(id: string) {
    try {
      const { error } = await supabase
        .from("doctor_slot_overrides")
        .delete()
        .eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["doctor-overrides", doctorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  // --- Render -------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border p-3">
        {/* Mode picker */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "full" ? "default" : "outline"}
            onClick={() => setMode("full")}
          >
            Full day(s)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "partial" ? "default" : "outline"}
            onClick={() => setMode("partial")}
          >
            Part of a day
          </Button>
        </div>

        {mode === "full" ? (
          <Grid>
            <div>
              <Label>From date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>To date (optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </Grid>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {startDate && daySlots && daySlots.dayOff && (
              <p className="text-xs text-muted-foreground">
                Doctor doesn't work on {DOCTOR_WEEKDAY_LABELS[daySlots.weekday]}s.
                Use <span className="font-medium">Full day(s)</span> instead.
              </p>
            )}

            {startDate && daySlots && !daySlots.dayOff && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Works{" "}
                    <span className="font-mono text-foreground">
                      {daySlots.windows
                        .map((w) => formatRange12(w.start, w.end))
                        .join(", ")}
                    </span>{" "}
                    on {DOCTOR_WEEKDAY_LABELS[daySlots.weekday]}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // One-click: block the entire working window.
                      const first = daySlots.windows[0];
                      const last =
                        daySlots.windows[daySlots.windows.length - 1];
                      if (first && last) {
                        setStartTime(first.start);
                        setEndTime(last.end);
                      }
                    }}
                  >
                    Block all working hours
                  </Button>
                </div>

                <Grid>
                  <div>
                    <Label>Start time</Label>
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    >
                      {daySlots.startOptions.length === 0 ? (
                        <option value="">No slots available</option>
                      ) : (
                        daySlots.startOptions.map((t) => (
                          <option key={t} value={t}>
                            {formatTime12(t)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <Label>End time</Label>
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    >
                      {daySlots.endOptionsFor(startTime).length === 0 ? (
                        <option value="">—</option>
                      ) : (
                        daySlots.endOptionsFor(startTime).map((t) => (
                          <option key={t} value={t}>
                            {formatTime12(t)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </Grid>
              </>
            )}

            {startDate && !daySlots && (
              <p className="text-xs text-muted-foreground">
                Loading doctor schedule…
              </p>
            )}

            {!startDate && (
              <p className="text-xs text-muted-foreground">
                Pick a date to see this doctor's working hours.
              </p>
            )}
          </div>
        )}

        <div>
          <Label>Reason (optional)</Label>
          <Input
            placeholder="Vacation, conference…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={onAdd} disabled={adding}>
            {adding ? "Adding…" : "Add time off"}
          </Button>
        </div>
      </div>

      {/* List of existing time-off entries */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Scheduled time off</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showPast} onCheckedChange={setShowPast} />
          Show past
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time off scheduled.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {visible.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="text-sm">
                <div className="font-medium">
                  {o.date}
                  {o.start_time && o.end_time ? (
                    <span className="ml-2 text-muted-foreground">
                      {formatRange12(
                        o.start_time.slice(0, 5),
                        o.end_time.slice(0, 5),
                      )}
                    </span>
                  ) : (
                    <span className="ml-2 text-muted-foreground">All day</span>
                  )}
                </div>
                {o.reason && (
                  <div className="text-xs text-muted-foreground">{o.reason}</div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemove(o.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
