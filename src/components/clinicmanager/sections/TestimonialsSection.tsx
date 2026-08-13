/**
 * TestimonialsSection — manage patient testimonials shown on the public page.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { TablePagination } from "@/components/superadmin/views/shared/TablePagination";
import { useTablePagination } from "@/components/superadmin/views/shared/useTablePagination";

import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { Card, SectionShell } from "../shared/SectionShell";
import {
  listTestimonials, upsertTestimonial, deleteTestimonial,
} from "@/lib/pagecontent.functions";
import type { DashboardClinic } from "../types";

type R = {
  id: string;
  patient_name: string;
  rating: number;
  quote: string;
  photo_url: string | null;
  review_date: string | null;
  display_order: number;
  is_featured: boolean;
};

export function TestimonialsSection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const list = useServerFn(listTestimonials);
  const upsert = useServerFn(upsertTestimonial);
  const del = useServerFn(deleteTestimonial);
  const { page, size } = useTablePagination();

  const q = useQuery({
    queryKey: ["testimonials", clinic.id, { page, size }],
    queryFn: () =>
      list({ data: { clinic_id: clinic.id, page, pageSize: size } }) as Promise<{ rows: R[]; total: number }>,
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  const [editing, setEditing] = useState<Partial<R> | null>(null);

  async function save() {
    if (!editing?.patient_name?.trim() || !editing.quote?.trim()) {
      toast.error("Name and quote are required");
      return;
    }
    try {
      await upsert({
        data: {
          id: editing.id,
          clinic_id: clinic.id,
          patient_name: editing.patient_name.trim(),
          rating: editing.rating ?? 5,
          quote: editing.quote.trim(),
          photo_url: editing.photo_url ?? "",
          review_date: editing.review_date ?? "",
          display_order: editing.display_order ?? total,
          is_featured: editing.is_featured ?? false,
        },
      });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["testimonials", clinic.id] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    try {
      await del({ data: { id, clinic_id: clinic.id } });
      qc.invalidateQueries({ queryKey: ["testimonials", clinic.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <SectionShell
      title="Patient testimonials"
      description="Curated reviews shown on your public booking page."
      actions={
        <Button onClick={() => setEditing({ rating: 5, is_featured: false })}>
          <Plus className="size-4" /> Add review
        </Button>
      }
    >
      <Card>
        {q.isLoading ? (
          <ul className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No reviews yet"
            description="Patient testimonials will appear here once added."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-3 transition-colors hover:bg-muted/30 rounded-xl px-2 -mx-2">
                  {r.photo_url ? (
                    <img src={r.photo_url} alt="" className="size-10 rounded-full object-cover ring-2 ring-background shadow-sm" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary ring-1 ring-primary/15">
                      {r.patient_name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.patient_name}</p>
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn("size-3.5", i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
                          />
                        ))}
                      </span>
                      {r.is_featured && (
                        <span className="rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{r.quote}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Edit review">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => remove(r.id)} aria-label="Delete review">
                    <Trash2 className="size-4" />
                  </Button>
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
            <DialogTitle>{editing?.id ? "Edit review" : "Add review"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Patient name</Label>
                <Input
                  value={editing.patient_name ?? ""}
                  maxLength={80}
                  onChange={(e) => setEditing({ ...editing, patient_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Rating</Label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEditing({ ...editing, rating: n })}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          "size-6",
                          (editing.rating ?? 5) >= n
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Quote</Label>
                <Textarea
                  rows={4}
                  maxLength={1000}
                  value={editing.quote ?? ""}
                  onChange={(e) => setEditing({ ...editing, quote: e.target.value })}
                />
              </div>
              <div>
                <Label>Photo URL (optional)</Label>
                <Input
                  type="url"
                  value={editing.photo_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Review date (optional)</Label>
                <Input
                  type="date"
                  value={editing.review_date ?? ""}
                  onChange={(e) => setEditing({ ...editing, review_date: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Featured</Label>
                <Switch
                  checked={editing.is_featured ?? false}
                  onCheckedChange={(c) => setEditing({ ...editing, is_featured: c })}
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
