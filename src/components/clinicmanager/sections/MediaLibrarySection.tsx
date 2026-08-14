/**
 * MediaLibrarySection — central view of all images uploaded to this
 * clinic's storage buckets. Manager can copy URLs or delete files.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Image, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, SectionShell } from "../shared/SectionShell";
import { MediaLibraryDialog } from "../shared/MediaLibraryDialog";
import { listClinicMedia, deleteClinicMedia, type MediaItem } from "@/lib/media.functions";
import type { DashboardClinic } from "../types";

type Filter = "all" | "clinic-logos" | "clinic-covers" | "clinic-gallery";

export function MediaLibrarySection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const list = useServerFn(listClinicMedia);
  const del = useServerFn(deleteClinicMedia);
  const [filter, setFilter] = useState<Filter>("all");

  const q = useQuery({
    queryKey: ["clinic-media", clinic.id],
    queryFn: () => list({ data: { clinic_id: clinic.id } }),
  });

  const items = (q.data?.rows ?? []).filter(
    (m: MediaItem) => filter === "all" || m.bucket === filter,
  );

  async function remove(m: MediaItem) {
    if (!confirm("Delete this image? Anywhere using it will break.")) return;
    try {
      await del({
        data: { clinic_id: clinic.id, bucket: m.bucket, path: m.path },
      });
      qc.invalidateQueries({ queryKey: ["clinic-media", clinic.id] });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <SectionShell
      title="Media library"
      description="Every image you've uploaded for this clinic. Uploads are auto-optimized to WebP."
      actions={
        <MediaLibraryDialog
          bucket="clinic-gallery"
          clinicId={clinic.id}
          label="Upload image"
          pickFromBuckets={["clinic-gallery", "clinic-covers", "clinic-logos"]}
          onSelect={() => qc.invalidateQueries({ queryKey: ["clinic-media", clinic.id] })}
        />
      }
    >
      <Card className="space-y-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clinic-logos">Logos</TabsTrigger>
            <TabsTrigger value="clinic-covers">Covers</TabsTrigger>
            <TabsTrigger value="clinic-gallery">Gallery</TabsTrigger>
          </TabsList>
        </Tabs>

        {q.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Image}
            title="No images yet"
            description="Upload your first image and it will appear here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((m) => (
              <div
                key={`${m.bucket}/${m.path}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 transition duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                <div className="aspect-square">
                  <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-background/95 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  <span className="truncate rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur">
                    {m.bucket.replace("clinic-", "")} · {(m.size / 1024).toFixed(0)} KB
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-7"
                      onClick={() => copy(m.url)}
                      title="Copy URL"
                      aria-label="Copy URL"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="size-7"
                      onClick={() => remove(m)}
                      title="Delete"
                      aria-label="Delete image"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </SectionShell>
  );
}
