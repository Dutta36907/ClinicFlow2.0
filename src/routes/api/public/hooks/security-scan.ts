/**
 * Scheduled security-scan trigger. Called by pg_cron (daily) and optionally
 * by an external post-deploy webhook. Authenticates via Supabase anon
 * `apikey` header — the documented pattern for /api/public/* cron callers.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  trigger: z.enum(["cron", "deploy", "manual"]).default("cron"),
  commit_sha: z.string().max(64).optional(),
});

export const Route = createFileRoute("/api/public/hooks/security-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          const raw = (await request.json().catch(() => ({}))) as unknown;
          parsed = bodySchema.parse(raw);
        } catch {
          return Response.json({ error: "Invalid body" }, { status: 400 });
        }

        try {
          const { runSecurityScan } = await import("@/lib/security-scan.server");
          const result = await runSecurityScan({
            trigger: parsed.trigger,
            commitSha: parsed.commit_sha ?? null,
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Scan failed";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
