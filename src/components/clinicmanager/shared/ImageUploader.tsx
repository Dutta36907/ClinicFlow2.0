/**
 * ImageUploader — upload an image directly to a Supabase storage
 * bucket scoped to the clinic id. Returns the public URL via onUploaded.
 *
 * Files are stored under `{bucket}/{clinicId}/{timestamp}-{name}` so RLS
 * (which checks the first folder = clinic id) lets managers upload.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import {
  BUCKET_LABEL,
  MAX_BYTES_BY_BUCKET,
  formatBytes,
  type OptimizeBucket,
} from "@/lib/image-optimize";
import { uploadClinicMedia } from "@/lib/media.functions";

type Props = {
  bucket: OptimizeBucket;
  clinicId: string;
  label?: string;
  /** Recommended aspect ratio, used only to warn the user. */
  recommendedRatio?: number;
  /** Recommended dimensions text shown as hint. */
  recommendedHint?: string;
  /** Override max file size in bytes. Defaults to per-bucket limit. */
  maxBytes?: number;
  onUploaded: (publicUrl: string) => void | Promise<void>;
};

export function ImageUploader({
  bucket,
  clinicId,
  label = "Upload image",
  recommendedRatio,
  recommendedHint,
  maxBytes,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const limit = maxBytes ?? MAX_BYTES_BY_BUCKET[bucket];
  const limitLabel = formatBytes(limit);
  const upload = useServerFn(uploadClinicMedia);

  async function handleFile(file: File) {
    // Strict MIME allowlist — SVG is rejected because SVGs can carry
    // embedded scripts and would be served from our origin.
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!ALLOWED.has(file.type)) {
      toast.error("Only JPEG, PNG, or WebP images are allowed");
      return;
    }
    if (file.size > limit) {
      toast.error(
        `${BUCKET_LABEL[bucket]} is too large: ${formatBytes(file.size)} (max ${limitLabel}). Please choose a smaller image.`,
      );
      return;
    }

    if (recommendedRatio) {
      const ratio = await readImageRatio(file);
      if (ratio && Math.abs(ratio - recommendedRatio) / recommendedRatio > 0.1) {
        toast.warning(
          `Image ratio doesn't match recommendation${recommendedHint ? ` (${recommendedHint})` : ""}. It will still upload but may look off.`,
        );
      }
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", bucket);
      fd.append("clinic_id", clinicId);
      const res = await upload({ data: fd });
      await onUploaded(res.url);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {label}
      </Button>
      <span className="text-xs text-muted-foreground">
        Max {limitLabel} · JPEG, PNG, or WebP
        {recommendedHint ? ` · ${recommendedHint}` : ""}
      </span>
    </div>
  );
}

function readImageRatio(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
      URL.revokeObjectURL(url);
      resolve(r);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
