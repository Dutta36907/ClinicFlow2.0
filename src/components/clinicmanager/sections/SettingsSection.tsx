/**
 * SettingsSection — three tabs of configuration.
 *
 *  - Clinic hours    → re-uses `WorkingHoursSection` (open/closed badge).
 *  - Doctors         → per-doctor appointment interval (slot length).
 *  - Team            → re-uses `TeamSection` (RBAC users).
 *
 * Per-doctor intervals are the source of truth for booking slot length;
 * the clinic-level field is legacy and only used as a fallback.
 */

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateDoctorInterval } from "@/lib/clinicmanager.functions";

import { Card, SectionShell } from "../shared/SectionShell";
import type { DashboardClinic, DashboardDoctor } from "../types";
import { WorkingHoursSection } from "./WorkingHoursSection";
import { TeamSection } from "./TeamSection";

export function SettingsSection({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  return (
    <SectionShell
      title="Settings"
      description="Configure clinic hours, per-doctor appointment intervals, and team access."
    >
      <Tabs defaultValue="hours" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="hours">Clinic hours</TabsTrigger>
          <TabsTrigger value="doctors">Doctors</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="hours" className="space-y-6">
          <WorkingHoursSection clinic={clinic} />
        </TabsContent>
        <TabsContent value="doctors" className="space-y-6">
          <DoctorIntervalsTab clinic={clinic} doctors={doctors} />
        </TabsContent>
        <TabsContent value="team" className="space-y-6">
          <TeamSection clinic={clinic} />
        </TabsContent>
      </Tabs>
    </SectionShell>
  );
}

const INTERVAL_PRESETS = [5, 10, 15, 20, 30, 45, 60];

function DoctorIntervalsTab({
  clinic,
  doctors,
}: {
  clinic: DashboardClinic;
  doctors: DashboardDoctor[];
}) {
  if (doctors.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-semibold">Per-doctor appointment intervals</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No doctors yet. Add a doctor in the Doctors section to configure their appointment
          interval here.
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h3 className="text-base font-semibold">Per-doctor appointment intervals</h3>
        <span className="text-xs text-muted-foreground">
          Default 15 min · used for patient booking slot length
        </span>
      </div>
      <div className="divide-y divide-border">
        {doctors.map((d) => (
          <DoctorIntervalRow key={d.id} clinicId={clinic.id} doctor={d} />
        ))}
      </div>
    </Card>
  );
}

function DoctorIntervalRow({ clinicId, doctor }: { clinicId: string; doctor: DashboardDoctor }) {
  const qc = useQueryClient();
  const save = useServerFn(updateDoctorInterval);
  const initial = doctor.appointment_duration_minutes ?? 15;
  const [value, setValue] = useState<number>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;

  // "custom" is shown in the select when the value doesn't match a preset.
  const presetSet = new Set(INTERVAL_PRESETS);
  const selectValue = presetSet.has(value) ? String(value) : "custom";

  async function onSave() {
    if (value < 5 || value > 240 || !Number.isInteger(value)) {
      toast.error("Interval must be a whole number between 5 and 240 minutes");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          clinic_id: clinicId,
          doctor_id: doctor.id,
          appointment_duration_minutes: value,
        },
      });
      toast.success(`${doctor.name}: interval set to ${value} min`);
      qc.invalidateQueries({ queryKey: ["manager-dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const initials = doctor.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/30">
      <div
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/15"
        aria-hidden
      >
        {initials || "DR"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{doctor.name}</div>
        {doctor.specialization && (
          <div className="truncate text-xs text-muted-foreground">{doctor.specialization}</div>
        )}
      </div>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm transition-colors hover:border-primary/40"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "custom") return;
          setValue(parseInt(v, 10));
        }}
        aria-label={`Preset interval for ${doctor.name}`}
      >
        {INTERVAL_PRESETS.map((n) => (
          <option key={n} value={n}>
            {n} min
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      <Input
        type="number"
        min={5}
        max={240}
        step={1}
        className="h-9 w-24 tabular-nums"
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value || "0", 10))}
        aria-label={`Custom interval minutes for ${doctor.name}`}
      />
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
