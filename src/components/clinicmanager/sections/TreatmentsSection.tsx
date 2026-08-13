/**
 * TreatmentsSection — manage treatments shown on the public page.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { TablePagination } from "@/components/superadmin/views/shared/TablePagination";
import { useTablePagination } from "@/components/superadmin/views/shared/useTablePagination";

import { toast } from "sonner";
import { Plus, Pencil, Trash2, Pill } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { Card, SectionShell } from "../shared/SectionShell";
import {
  listTreatments, upsertTreatment, deleteTreatment,
} from "@/lib/pagecontent.functions";
import { TREATMENT_ICONS, TreatmentIcon } from "@/components/landing/treatment-icons";
import type { DashboardClinic } from "../types";

type T = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
};

export function TreatmentsSection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const list = useServerFn(listTreatments);
  const upsert = useServerFn(upsertTreatment);
  const del = useServerFn(deleteTreatment);
  const { page, size } = useTablePagination();

  const q = useQuery({
    queryKey: ["treatments", clinic.id, { page, size }],
    queryFn: () => list({ data: { clinic_id: clinic.id, page, pageSize: size } }) as Promise<{ rows: T[]; total: number }>,
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  const [editing, setEditing] = useState<Partial<T> | null>(null);

  async function save() {
    if (!editing) return;
    if (!editing.title?.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await upsert({
        data: {
          id: editing.id,
          clinic_id: clinic.id,
          title: editing.title.trim(),
          description: editing.description ?? "",
          icon: editing.icon ?? "",
          display_order: editing.display_order ?? total,
          is_active: editing.is_active ?? true,
        },
      });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["treatments", clinic.id] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }


  async function remove(id: string) {
    if (!confirm("Delete this treatment?")) return;
    try {
      await del({ data: { id, clinic_id: clinic.id } });
      qc.invalidateQueries({ queryKey: ["treatments", clinic.id] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <SectionShell
      title="Treatments"
      description="Specialty services your clinic offers."
      actions={
        <Button
          onClick={() => setEditing({ is_active: true, display_order: total })}
          className="gap-2 shadow-sm"
        >
          <Plus className="size-4" /> Add treatment
        </Button>
      }
    >
      <Card className={q.isLoading || rows.length === 0 ? "" : "p-0"}>
        {q.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No treatments yet"
            description="Add your first treatment to showcase it on your public page."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">
                    <TreatmentIcon name={t.icon ?? undefined} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{t.title}</p>
                      {!t.is_active && (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${t.title}`}
                      className="hover:bg-primary/10 hover:text-primary"
                      onClick={() => setEditing(t)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${t.title}`}
                      className="hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <TablePagination total={total} />
          </>
        )}
      </Card>


      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit treatment" : "Add treatment"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={editing.title ?? ""}
                  maxLength={80}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Icon</Label>
                <Select
                  value={editing.icon ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, icon: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pick an icon" /></SelectTrigger>
                  <SelectContent>
                    {TREATMENT_ICONS.map((i) => (
                      <SelectItem key={i.name} value={i.name}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Visible on public page</Label>
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(c) => setEditing({ ...editing, is_active: c })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}
