/**
 * WorkingHoursSection — manages the clinic's *physical* open/closed hours.
 *
 * IMPORTANT: these hours do NOT drive appointment availability. They only
 * power the "Open now / Closed now" badge on the public booking page.
 * Booking slots come from each doctor's own working hours (see
 * `DoctorsSection` → Working hours tab).
 */

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateClinicWorkingHours } from "@/lib/clinicmanager.functions";

import { Card, SectionShell } from "../shared/SectionShell";
import { DAYS, type DayKey } from "../shared/days";
import type { DashboardClinic } from "../types";

export function WorkingHoursSection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const update = useServerFn(updateClinicWorkingHours);

  // --- Local state seeded from saved hours --------------------------------
  const [hours, setHours] = useState(() => {
    const seed: Record<string, [string, string] | null> = {};
    for (const d of DAYS) {
      const v = clinic.working_hours?.[d.key];
      seed[d.key] = Array.isArray(v) ? [v[0], v[1]] : null;
    }
    return seed as Record<DayKey, [string, string] | null>;
  });
  const [saving, setSaving] = useState(false);

  function setDay(key: DayKey, val: [string, string] | null) {
    setHours((h) => ({ ...h, [key]: val }));
  }

  // --- Save handler -------------------------------------------------------
  async function onSave() {
    setSaving(true);
    try {
      await update({ data: { id: clinic.id, working_hours: hours } });
      toast.success("Working hours updated");
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const openCount = DAYS.filter((d) => hours[d.key] !== null).length;

  // --- Render -------------------------------------------------------------
  return (
    <SectionShell
      title="Clinic open hours (shown to patients)"
      description="When your clinic is physically open. Appointment time slots are taken from each doctor's schedule — these hours only control the open/closed badge on your public page."
      actions={
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      }
    >
      <Card className="flex items-start gap-3 border-primary/15 bg-primary/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">
          Patients see <span className="font-medium text-foreground">{openCount} of 7</span>{" "}
          {openCount === 1 ? "day" : "days"} as open. Toggle a day off to mark it closed.
        </p>
      </Card>

      <Card className="divide-y divide-border p-0">
        {DAYS.map((d) => {
          const v = hours[d.key];
          const open = v !== null;
          return (
            <div
              key={d.key}
              className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={open}
                  onCheckedChange={(c) => setDay(d.key, c ? ["09:00", "17:00"] : null)}
                  aria-label={`Toggle ${d.label}`}
                />
                <div
                  className={`grid size-9 place-items-center rounded-lg ring-1 transition-colors ${
                    open
                      ? "bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-primary/15"
                      : "bg-muted text-muted-foreground ring-border"
                  }`}
                  aria-hidden
                >
                  <Clock className="size-4" />
                </div>
                <span className="w-24 text-sm font-medium">{d.label}</span>
              </div>
              {open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={v![0]}
                    className="w-32 tabular-nums"
                    onChange={(e) => setDay(d.key, [e.target.value, v![1]])}
                    aria-label={`${d.label} opens at`}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={v![1]}
                    className="w-32 tabular-nums"
                    onChange={(e) => setDay(d.key, [v![0], e.target.value])}
                    aria-label={`${d.label} closes at`}
                  />
                </div>
              ) : (
                <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Closed
                </span>
              )}
            </div>
          );
        })}
      </Card>
    </SectionShell>
  );
}
