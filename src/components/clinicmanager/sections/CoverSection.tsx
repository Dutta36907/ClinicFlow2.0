/**
 * CoverSection — upload/replace the public-page cover image.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, SectionShell } from "../shared/SectionShell";
import { MediaLibraryDialog } from "../shared/MediaLibraryDialog";
import { updateClinicCover } from "@/lib/pagecontent.functions";
import type { DashboardClinic } from "../types";

export function CoverSection({ clinic }: { clinic: DashboardClinic & { cover_image_url?: string | null } }) {
  const qc = useQueryClient();
  const update = useServerFn(updateClinicCover);
  const [currentUrl, setCurrentUrl] = useState<string | null>(clinic.cover_image_url ?? null);

  async function setCover(url: string | null) {
    try {
      await update({ data: { id: clinic.id, cover_image_url: url } });
      setCurrentUrl(url);
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
      toast.success(url ? "Cover updated" : "Cover removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <SectionShell
      title="Cover photo"
      description="The wide banner shown at the top of your public booking page."
    >
      <Card className="space-y-5">
        <div
          className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 ring-1 ring-border/50 transition-all hover:shadow-lg hover:shadow-primary/5"
          style={{ aspectRatio: "16 / 5" }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Cover"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                <ImageIcon className="size-5" />
              </div>
              <p>No cover image yet</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Recommended size: 1920 × 480 px (16:5 banner, PNG or WebP).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <MediaLibraryDialog
            bucket="clinic-covers"
            clinicId={clinic.id}
            label={currentUrl ? "Replace cover" : "Upload cover"}
            recommendedHint="Wide 1920×480 works best"
            onSelect={(url) => setCover(url)}
          />
          {currentUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCover(null)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove cover"
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </Card>
    </SectionShell>
  );
}
