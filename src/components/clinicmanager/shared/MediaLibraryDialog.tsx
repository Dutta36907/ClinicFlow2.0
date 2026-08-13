/**
 * MediaLibraryDialog — unified picker used everywhere a clinic image is
 * added (cover, logo, gallery, testimonial photos). Lets managers pick
 * from previously uploaded files OR upload a new one (auto-optimized).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, ImagePlus, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  BUCKET_LABEL,
  MAX_BYTES_BY_BUCKET,
  formatBytes,
  optimizeImage,
  type OptimizeBucket,
} from "@/lib/image-optimize";
import {
  listClinicMedia,
  uploadClinicMedia,
  type MediaItem,
} from "@/lib/media.functions";

type Props = {
  bucket: OptimizeBucket;
  clinicId: string;
  trigger?: React.ReactNode;
  label?: string;
  recommendedHint?: string;
  /** Show items from these buckets in the "Choose existing" tab. Defaults to [bucket]. */
  pickFromBuckets?: OptimizeBucket[];
  /** Allow picking / uploading multiple images in one go. Default false. */
  multi?: boolean;
  onSelect: (publicUrl: string) => void | Promise<void>;
};

export function MediaLibraryDialog({
  bucket,
  clinicId,
  trigger,
  label = "Add image",
  recommendedHint,
  pickFromBuckets,
  multi = false,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <ImagePlus className="size-4" /> {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
        </DialogHeader>
        {open && (
          <Body
            bucket={bucket}
            clinicId={clinicId}
            recommendedHint={recommendedHint}
            pickFromBuckets={pickFromBuckets ?? [bucket]}
            multi={multi}
            onPickMany={async (urls) => {
              for (const u of urls) {
                await onSelect(u);
              }
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  bucket,
  clinicId,
  recommendedHint,
  pickFromBuckets,
  multi,
  onPickMany,
}: {
  bucket: OptimizeBucket;
  clinicId: string;
  recommendedHint?: string;
  pickFromBuckets: OptimizeBucket[];
  multi: boolean;
  onPickMany: (urls: string[]) => Promise<void>;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listClinicMedia);
  const mediaQ = useQuery({
    queryKey: ["clinic-media", clinicId],
    queryFn: () => list({ data: { clinic_id: clinicId } }),
  });

  const items = (mediaQ.data?.rows ?? []).filter((m: MediaItem) =>
    pickFromBuckets.includes(m.bucket as OptimizeBucket),
  );

  const [tab, setTab] = useState<"existing" | "upload">(
    items.length > 0 ? "existing" : "upload",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!mediaQ.isLoading && items.length === 0) setTab("upload");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaQ.isLoading, items.length === 0]);

  const selectedUrls = useMemo(
    () => items.filter((m) => selected.has(m.url)).map((m) => m.url),
    [items, selected],
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="existing">
          Choose existing {items.length > 0 && `(${items.length})`}
        </TabsTrigger>
        <TabsTrigger value="upload">Upload new</TabsTrigger>
      </TabsList>

      <TabsContent value="existing" className="mt-4">
        {mediaQ.isLoading ? (
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-hidden pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-lg border border-border bg-gradient-to-br from-muted/60 to-muted/20"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
              <ImagePlus className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nothing uploaded yet — switch to <span className="font-medium text-foreground">Upload new</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((m) => (
                <MediaTile
                  key={`${m.bucket}/${m.path}`}
                  item={m}
                  multi={multi}
                  isSelected={selected.has(m.url)}
                  onToggle={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.url)) next.delete(m.url);
                      else next.add(m.url);
                      return next;
                    });
                  }}
                  onPickSingle={async () => {
                    await onPickMany([m.url]);
                  }}
                />
              ))}
            </div>
            {multi && (
              <div className="sticky bottom-0 mt-3 flex items-center justify-between border-t border-border bg-background/95 py-3 backdrop-blur">
                <p className="text-sm text-muted-foreground">
                  {selectedUrls.length} selected
                </p>
                <Button
                  type="button"
                  disabled={selectedUrls.length === 0}
                  onClick={() => onPickMany(selectedUrls)}
                >
                  Add selected
                </Button>
              </div>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="upload" className="mt-4">
        <UploadPane
          bucket={bucket}
          clinicId={clinicId}
          recommendedHint={recommendedHint}
          multi={multi}
          onUploadedBatch={async (urls) => {
            qc.invalidateQueries({ queryKey: ["clinic-media", clinicId] });
            await onPickMany(urls);
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

function MediaTile({
  item,
  multi,
  isSelected,
  onToggle,
  onPickSingle,
}: {
  item: MediaItem;
  multi: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onPickSingle: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (multi) {
          onToggle();
          return;
        }
        setBusy(true);
        try {
          await onPickSingle();
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted/30 transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10 hover:ring-2 hover:ring-primary/30",
      )}
    >
      <img
        src={item.url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
      />
      <span className="absolute bottom-1.5 left-1.5 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
        {item.bucket.replace("clinic-", "")}
      </span>
      {multi && isSelected && (
        <span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Check className="size-4" />
        </span>
      )}
      {!multi && (
        <span className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition group-hover:bg-primary/20 group-hover:opacity-100">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-primary-foreground" />
          ) : (
            <Check className="size-7 rounded-full bg-primary p-1.5 text-primary-foreground shadow-lg shadow-primary/30" />
          )}
        </span>
      )}
    </button>
  );
}

function UploadPane({
  bucket,
  clinicId,
  recommendedHint,
  multi,
  onUploadedBatch,
}: {
  bucket: OptimizeBucket;
  clinicId: string;
  recommendedHint?: string;
  multi: boolean;
  onUploadedBatch: (urls: string[]) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const limit = MAX_BYTES_BY_BUCKET[bucket];
  const limitLabel = formatBytes(limit);
  const upload = useServerFn(uploadClinicMedia);

  // Permissive raw cap — we compress on-device before upload, so a
  // typical 5–10 MB phone photo shrinks well under the per-bucket limit.
  const RAW_MAX = 20 * 1024 * 1024;

  const recipe =
    bucket === "clinic-logos"
      ? "Square logo. We auto-crop to 512×512 and compress to WebP."
      : bucket === "clinic-covers"
      ? "Wide banner. We auto-crop to 1920×480 and compress to WebP."
      : multi
      ? "Pick one or many. We resize the longest side to 1920 px and compress to WebP."
      : "Any photo. We resize the longest side to 1920 px and compress to WebP.";

  async function uploadOne(file: File): Promise<string | null> {
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!ALLOWED.has(file.type)) {
      toast.error(`${file.name}: please use JPEG, PNG, or WebP.`);
      return null;
    }
    if (file.size > RAW_MAX) {
      toast.error(`${file.name} is ${formatBytes(file.size)} — over ${formatBytes(RAW_MAX)}.`);
      return null;
    }
    const optimized = await optimizeImage(file, bucket);
    if (optimized.size > limit) {
      toast.error(
        `${file.name}: couldn't shrink enough (${formatBytes(optimized.size)}, max ${limitLabel}).`,
      );
      return null;
    }
    const fd = new FormData();
    fd.append("file", optimized);
    fd.append("bucket", bucket);
    fd.append("clinic_id", clinicId);
    const res = await upload({ data: fd });
    return res.url;
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setStatus(
          files.length > 1
            ? `Uploading ${i + 1} of ${files.length}…`
            : "Optimizing & uploading…",
        );
        try {
          const url = await uploadOne(files[i]);
          if (url) uploaded.push(url);
        } catch (e) {
          toast.error(
            `${files[i].name}: ${e instanceof Error ? e.message : "upload failed"}`,
          );
        }
      }
      if (uploaded.length > 0) {
        toast.success(
          uploaded.length === 1 ? "Uploaded" : `Uploaded ${uploaded.length} images`,
        );
        await onUploadedBatch(uploaded);
      }
    } finally {
      setBusy(false);
      setStatus(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) handleFiles(multi ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all",
        dragging
          ? "border-primary bg-primary/5 ring-4 ring-primary/15"
          : "border-border bg-gradient-to-br from-muted/30 to-muted/10",
        busy && "opacity-70",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multi}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleFiles(files);
        }}
      />
      <div
        className={cn(
          "grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20 transition-transform",
          dragging && "scale-110",
        )}
      >
        {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {dragging
            ? "Release to upload"
            : multi
            ? "Drop images or click Browse (pick many)"
            : "Drop an image or click Browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          {recipe}
          {recommendedHint ? ` ${recommendedHint}.` : ""}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          JPEG, PNG or WebP · up to 20 MB each — we shrink them for you
        </p>
        {busy && status ? (
          <p className="text-xs font-medium text-primary">{status}</p>
        ) : null}
      </div>
      <Button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? (status ?? "Working…") : "Browse"}
      </Button>
    </div>
  );
}
