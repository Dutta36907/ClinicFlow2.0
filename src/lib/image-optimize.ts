/**
 * Client-side image optimization for clinic uploads.
 *
 * Resizes and re-encodes images to WebP (with JPEG fallback) before
 * upload, so storage stays small and the public page loads fast.
 */

import type { ClinicBucket } from "./image-limits";

export type OptimizeBucket = ClinicBucket;

// Re-export shared limits/labels so existing imports from this module keep working.
export { MAX_BYTES_BY_BUCKET, BUCKET_LABEL, ALLOWED_IMAGE_MIME, formatBytes } from "./image-limits";

type Target = {
  /** Target output width (cover-fit) or undefined to keep ratio. */
  w?: number;
  /** Target output height (cover-fit) or undefined to keep ratio. */
  h?: number;
  /** Max longest edge when neither w/h is fixed. */
  maxEdge?: number;
  /** Whether to crop to exact w/h (true) or fit-inside. */
  cover?: boolean;
};

const TARGETS: Record<OptimizeBucket, Target> = {
  "clinic-logos": { w: 512, h: 512, cover: true },
  "clinic-covers": { w: 1920, h: 480, cover: true },
  "clinic-gallery": { maxEdge: 1920 },
};

const SMALL_BYTES = 200 * 1024;

export async function optimizeImage(
  file: File,
  bucket: OptimizeBucket,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // SVG / GIF: don't touch (would lose vector / animation).
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const target = TARGETS[bucket];
  const bitmap = await loadBitmap(file);
  const { width: sw, height: sh } = bitmap;

  const { dw, dh, sx, sy, sCropW, sCropH } = computeDims(sw, sh, target);

  // Cheap-out: source already small enough and file is tiny → keep as-is.
  if (dw >= sw && dh >= sh && file.size < SMALL_BYTES) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sCropW, sCropH, 0, 0, dw, dh);
  bitmap.close?.();

  const webp = await canvasToBlob(canvas, "image/webp", quality);
  const final = webp ?? (await canvasToBlob(canvas, "image/jpeg", quality)) ?? null;
  if (!final) return file;

  // If optimized is somehow larger than the source, keep source.
  if (final.size >= file.size) return file;

  const ext = final.type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([final], `${base}.${ext}`, { type: final.type });
}

function computeDims(sw: number, sh: number, t: Target) {
  if (t.w && t.h && t.cover) {
    const dw = t.w;
    const dh = t.h;
    const srcRatio = sw / sh;
    const dstRatio = dw / dh;
    let sCropW = sw;
    let sCropH = sh;
    if (srcRatio > dstRatio) {
      // source wider → crop sides
      sCropW = sh * dstRatio;
    } else {
      sCropH = sw / dstRatio;
    }
    const sx = (sw - sCropW) / 2;
    const sy = (sh - sCropH) / 2;
    return { dw, dh, sx, sy, sCropW, sCropH };
  }
  // maxEdge: fit inside, preserve ratio
  const maxEdge = t.maxEdge ?? 1920;
  const longest = Math.max(sw, sh);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    dw: Math.round(sw * scale),
    dh: Math.round(sh * scale),
    sx: 0,
    sy: 0,
    sCropW: sw,
    sCropH: sh,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap & { close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    return (await createImageBitmap(file)) as ImageBitmap & { close?: () => void };
  }
  // Fallback for older browsers
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    } as unknown as ImageBitmap & { close?: () => void };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Failed to read image");
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
