/**
 * StatsSection — edit the manager-controlled performance tiles
 * shown on the public landing page (Years Experience, Patients, etc.).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, SectionShell } from "../shared/SectionShell";
import { updateClinicStats } from "@/lib/pagecontent.functions";
import type { DashboardClinic } from "../types";

type Stat = { label: string; value: string };

export function StatsSection({
  clinic,
}: {
  clinic: DashboardClinic & { performance_stats?: Stat[] };
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateClinicStats);
  const [stats, setStats] = useState<Stat[]>(
    (clinic.performance_stats?.length ?? 0) > 0
      ? clinic.performance_stats!
      : [
          { label: "Years Experience", value: "15+" },
          { label: "Happy Patients", value: "10k+" },
          { label: "Success Rate", value: "98%" },
        ],
  );
  const [busy, setBusy] = useState(false);

  function patch(i: number, key: keyof Stat, v: string) {
    setStats((s) => s.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  }
  function remove(i: number) {
    setStats((s) => s.filter((_, idx) => idx !== i));
  }
  function add() {
    if (stats.length >= 4) return;
    setStats((s) => [...s, { label: "", value: "" }]);
  }

  async function onSave() {
    const cleaned = stats
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value);
    setBusy(true);
    try {
      await save({ data: { id: clinic.id, performance_stats: cleaned } });
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
      toast.success("Stats updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionShell
      title="Performance stats"
      description="The numbers shown in the Clinic Performance card on your public page."
      actions={
        <Button onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      }
    >
      <Card className="space-y-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="group grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_1fr_140px_auto] sm:items-end"
          >
            <div className="hidden sm:grid sm:size-9 sm:place-items-center sm:rounded-lg sm:bg-gradient-to-br sm:from-primary/15 sm:to-primary/5 sm:text-primary sm:ring-1 sm:ring-primary/15">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={s.label}
                maxLength={40}
                placeholder="e.g. Years Experience"
                onChange={(e) => patch(i, "label", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input
                value={s.value}
                maxLength={20}
                placeholder="e.g. 15+"
                className="tabular-nums"
                onChange={(e) => patch(i, "value", e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove stat"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {stats.length < 4 && (
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" /> Add stat
          </Button>
        )}
      </Card>
    </SectionShell>
  );
}
