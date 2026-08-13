/**
 * GallerySection — upload/remove clinic photos for the public page.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { TablePagination } from "@/components/superadmin/views/shared/TablePagination";
import { useTablePagination } from "@/components/superadmin/views/shared/useTablePagination";

import { toast } from "sonner";
import { Image, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, SectionShell } from "../shared/SectionShell";
import { MediaLibraryDialog } from "../shared/MediaLibraryDialog";
import {
  listGallery, addGalleryImage, deleteGalleryImage,
} from "@/lib/pagecontent.functions";
import type { DashboardClinic } from "../types";

type G = { id: string; image_url: string; caption: string | null; display_order: number };

export function GallerySection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const list = useServerFn(listGallery);
  const add = useServerFn(addGalleryImage);
  const del = useServerFn(deleteGalleryImage);
  const { page, size } = useTablePagination();

  const q = useQuery({
    queryKey: ["gallery", clinic.id, { page, size }],
    queryFn: () =>
      list({ data: { clinic_id: clinic.id, page, pageSize: size } }) as Promise<{ rows: G[]; total: number }>,
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  async function onUploaded(url: string) {
    try {
      await add({
        data: {
          clinic_id: clinic.id,
          image_url: url,
          caption: "",
          display_order: total,
        },
      });
      qc.invalidateQueries({ queryKey: ["gallery", clinic.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this image?")) return;
    try {
      await del({ data: { id, clinic_id: clinic.id } });
      qc.invalidateQueries({ queryKey: ["gallery", clinic.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <SectionShell
      title="Gallery"
      description="Photos shown in the gallery on your public page."
      actions={
        <MediaLibraryDialog
          bucket="clinic-gallery"
          clinicId={clinic.id}
          label="Add photos"
          multi
          recommendedHint="Pick one or many — JPEG, PNG or WebP"
          onSelect={onUploaded}
        />
      }
    >
      <Card>
        {q.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Image}
            title="No photos yet"
            description="Upload your first photo using the button above."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((g) => (
                <div key={g.id} className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 aspect-square transition duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                  <img src={g.image_url} alt={g.caption ?? ""} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute right-2 top-2 size-8 opacity-0 transition group-hover:opacity-100"
                    onClick={() => remove(g.id)}
                    aria-label="Delete photo"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <TablePagination total={total} />
          </>
        )}
      </Card>

    </SectionShell>
  );
}
