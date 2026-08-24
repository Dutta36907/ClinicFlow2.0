/**
 * AvatarPickerDialog — pick a profile avatar from previously uploaded
 * images or upload a new one. Scoped to the current user's own uploads
 * (avatars storage bucket, RLS keyed by the auth.uid() folder).
 */
import { useEffect, useRef, useState } from "react";
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
import { formatBytes, optimizeImage } from "@/lib/image-optimize";
import { AVATAR_MAX_BYTES, ALLOWED_IMAGE_MIME } from "@/lib/image-limits";
import { listMyAvatars, uploadMyAvatar, type AvatarItem } from "@/lib/media.functions";

type Props = {
  trigger?: React.ReactNode;
  onSelect: (publicUrl: string) => void | Promise<void>;
};

export function AvatarPickerDialog({ trigger, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <ImagePlus className="size-4" /> Change avatar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose avatar</DialogTitle>
        </DialogHeader>
        {open && (
          <Body
            onPick={async (url) => {
              await onSelect(url);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ onPick }: { onPick: (url: string) => Promise<void> }) {
  const qc = useQueryClient();
  const list = useServerFn(listMyAvatars);
  const mediaQ = useQuery({ queryKey: ["my-avatars"], queryFn: () => list() });
  const items = mediaQ.data?.rows ?? [];

  const [tab, setTab] = useState<"existing" | "upload">(items.length > 0 ? "existing" : "upload");

  useEffect(() => {
    if (!mediaQ.isLoading && items.length === 0) setTab("upload");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaQ.isLoading, items.length === 0]);

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
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-full border border-border bg-gradient-to-br from-muted/60 to-muted/20"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
              <ImagePlus className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nothing uploaded yet — switch to{" "}
              <span className="font-medium text-foreground">Upload new</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {items.map((m) => (
              <AvatarTile key={m.path} item={m} onPick={() => onPick(m.url)} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="upload" className="mt-4">
        <UploadPane
          onUploaded={async (url) => {
            qc.invalidateQueries({ queryKey: ["my-avatars"] });
            await onPick(url);
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

function AvatarTile({ item, onPick }: { item: AvatarItem; onPick: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onPick();
        } finally {
          setBusy(false);
        }
      }}
      className="group relative aspect-square overflow-hidden rounded-full border border-border bg-muted/30 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10 hover:ring-2 hover:ring-primary/30"
    >
      <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition group-hover:bg-primary/20 group-hover:opacity-100">
        {busy ? (
          <Loader2 className="size-5 animate-spin text-primary-foreground" />
        ) : (
          <Check className="size-6 rounded-full bg-primary p-1 text-primary-foreground shadow-lg shadow-primary/30" />
        )}
      </span>
    </button>
  );
}

function UploadPane({ onUploaded }: { onUploaded: (url: string) => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const upload = useServerFn(uploadMyAvatar);

  // Permissive raw cap — we compress on-device before upload.
  const RAW_MAX = 20 * 1024 * 1024;

  async function handleFile(file: File) {
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      toast.error("Please use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > RAW_MAX) {
      toast.error(`${file.name} is ${formatBytes(file.size)} — over ${formatBytes(RAW_MAX)}.`);
      return;
    }
    setBusy(true);
    try {
      const optimized = await optimizeImage(file, "avatars");
      if (optimized.size > AVATAR_MAX_BYTES) {
        toast.error(
          `Couldn't shrink enough (${formatBytes(optimized.size)}, max ${formatBytes(AVATAR_MAX_BYTES)}).`,
        );
        return;
      }
      const fd = new FormData();
      fd.append("file", optimized);
      const res = await upload({ data: fd });
      toast.success("Uploaded");
      await onUploaded(res.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
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
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
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
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
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
          {dragging ? "Release to upload" : "Drop an image or click Browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          Square photo. We auto-crop to 512×512 and compress to WebP.
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          JPEG, PNG or WebP · up to 20 MB — we shrink it for you
        </p>
      </div>
      <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Working…" : "Browse"}
      </Button>
    </div>
  );
}
