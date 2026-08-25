/**
 * Media library server functions — list and delete uploaded images
 * across the three clinic storage buckets.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertClinicAccess } from "@/lib/server/auth-context";
import {
  ALLOWED_IMAGE_MIME,
  AVATAR_MAX_BYTES,
  BUCKET_LABEL,
  CLINIC_BUCKETS,
  MAX_BYTES_BY_BUCKET,
  formatBytes,
  type ClinicBucket,
} from "@/lib/image-limits";

async function getAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}

const BUCKETS = CLINIC_BUCKETS;
type Bucket = ClinicBucket;

export type MediaItem = {
  bucket: Bucket;
  path: string;
  url: string;
  size: number;
  updated_at: string | null;
};

const listMediaSchema = z.object({
  clinic_id: z.string().uuid(),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const listClinicMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listMediaSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ rows: MediaItem[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    const all: MediaItem[] = [];
    const perBucket = await Promise.all(
      BUCKETS.map((bucket) =>
        supabaseAdmin.storage
          .from(bucket)
          .list(data.clinic_id, {
            limit: 1000,
            sortBy: { column: "updated_at", order: "desc" },
          })
          .then((res) => ({ bucket, ...res })),
      ),
    );
    for (const { bucket, data: rows, error } of perBucket) {
      if (error) continue;
      for (const r of rows ?? []) {
        if (!r.name || r.name.startsWith(".")) continue;
        const path = `${data.clinic_id}/${r.name}`;
        const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
        all.push({
          bucket,
          path,
          url: pub.publicUrl,
          size: (r.metadata as { size?: number } | null)?.size ?? 0,
          updated_at: r.updated_at ?? r.created_at ?? null,
        });
      }
    }
    all.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    const total = all.length;
    const from = (data.page - 1) * data.pageSize;
    const rows = all.slice(from, from + data.pageSize);
    return { rows, total };
  });

export const deleteClinicMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        bucket: z.enum(["clinic-logos", "clinic-covers", "clinic-gallery"]),
        path: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);
    if (!data.path.startsWith(`${data.clinic_id}/`)) {
      throw new Error("Invalid path");
    }
    const { error } = await supabaseAdmin.storage.from(data.bucket).remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Upload a clinic image through the server, enforcing per-bucket MIME
 * and size limits as the security boundary. The browser can also call
 * supabase.storage.upload directly (allowed by RLS), but routing through
 * this fn lets us reject oversized files before they hit storage.
 */
export const uploadClinicMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) {
      throw new Error("Expected multipart form data");
    }
    const file = d.get("file");
    const bucket = d.get("bucket");
    const clinicId = d.get("clinic_id");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (typeof bucket !== "string" || !BUCKETS.includes(bucket as Bucket)) {
      throw new Error("Invalid bucket");
    }
    if (typeof clinicId !== "string") throw new Error("Missing clinic_id");
    const parsed = z.string().uuid().parse(clinicId);
    return { file, bucket: bucket as Bucket, clinic_id: parsed };
  })
  .handler(async ({ data, context }): Promise<{ url: string; path: string }> => {
    const supabaseAdmin = await getAdmin();
    await assertClinicAccess(context.userId, data.clinic_id);

    // MIME allowlist — SVG/GIF/HTML rejected.
    if (!ALLOWED_IMAGE_MIME.has(data.file.type)) {
      throw new Error("Only JPEG, PNG, or WebP images are allowed");
    }

    // Per-bucket size limit — the security boundary. Mirrors the
    // client-side check in image-limits.ts, but cannot be bypassed.
    const limit = MAX_BYTES_BY_BUCKET[data.bucket];
    if (data.file.size > limit) {
      throw new Error(
        `${BUCKET_LABEL[data.bucket]} is too large: ${formatBytes(
          data.file.size,
        )} (max ${formatBytes(limit)})`,
      );
    }

    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extByMime[data.file.type] ?? "jpg";
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${data.clinic_id}/${Date.now()}-${rand}.${ext}`;

    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error } = await supabaseAdmin.storage.from(data.bucket).upload(path, bytes, {
      cacheControl: "31536000",
      upsert: false,
      contentType: data.file.type,
    });
    if (error) throw new Error(error.message);

    const { data: pub } = supabaseAdmin.storage.from(data.bucket).getPublicUrl(path);
    return { url: pub.publicUrl, path };
  });

// ----------------------------------------------------------------------------
// Avatars — same shape as clinic media, but owned by the user's own id
// folder instead of a clinic id.
// ----------------------------------------------------------------------------

export type AvatarItem = { path: string; url: string; size: number; updated_at: string | null };

export const listMyAvatars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AvatarItem[] }> => {
    const supabaseAdmin = await getAdmin();
    const { data: rows, error } = await supabaseAdmin.storage
      .from("avatars")
      .list(context.userId, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
    if (error) throw new Error(error.message);
    const items: AvatarItem[] = [];
    for (const r of rows ?? []) {
      if (!r.name || r.name.startsWith(".")) continue;
      const path = `${context.userId}/${r.name}`;
      const { data: pub } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
      items.push({
        path,
        url: pub.publicUrl,
        size: (r.metadata as { size?: number } | null)?.size ?? 0,
        updated_at: r.updated_at ?? r.created_at ?? null,
      });
    }
    return { rows: items };
  });

export const uploadMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected multipart form data");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    return { file };
  })
  .handler(async ({ data, context }): Promise<{ url: string; path: string }> => {
    const supabaseAdmin = await getAdmin();

    if (!ALLOWED_IMAGE_MIME.has(data.file.type)) {
      throw new Error("Only JPEG, PNG, or WebP images are allowed");
    }
    if (data.file.size > AVATAR_MAX_BYTES) {
      throw new Error(
        `Avatar is too large: ${formatBytes(data.file.size)} (max ${formatBytes(AVATAR_MAX_BYTES)})`,
      );
    }

    const extByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = extByMime[data.file.type] ?? "jpg";
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${context.userId}/${Date.now()}-${rand}.${ext}`;

    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error } = await supabaseAdmin.storage.from("avatars").upload(path, bytes, {
      cacheControl: "31536000",
      upsert: false,
      contentType: data.file.type,
    });
    if (error) throw new Error(error.message);

    const { data: pub } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    return { url: pub.publicUrl, path };
  });
