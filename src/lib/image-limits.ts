/**
 * Shared image-upload limits — safe to import from both client and server.
 * No DOM, no Node, no Supabase deps.
 */

export type ClinicBucket = "clinic-logos" | "clinic-covers" | "clinic-gallery";

export const CLINIC_BUCKETS: readonly ClinicBucket[] = [
  "clinic-logos",
  "clinic-covers",
  "clinic-gallery",
] as const;

/**
 * Maximum allowed size of the uploaded file, per bucket. Enforced both
 * client-side (early UX validation) and server-side (security boundary —
 * cannot be bypassed by calling the server fn directly).
 */
export const MAX_BYTES_BY_BUCKET: Record<ClinicBucket, number> = {
  "clinic-logos": 512 * 1024,
  "clinic-covers": 1 * 1024 * 1024,
  "clinic-gallery": 2 * 1024 * 1024,
};

export const BUCKET_LABEL: Record<ClinicBucket, string> = {
  "clinic-logos": "Logo",
  "clinic-covers": "Cover image",
  "clinic-gallery": "Gallery image",
};

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Human-friendly size formatter: "512 KB", "1 MB", "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 || Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}
