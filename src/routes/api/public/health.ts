/**
 * Public health probe — called by uptime monitors. Returns 200/JSON in both
 * healthy and degraded cases so the monitor's HTTP status alarm doesn't
 * flap; status is encoded in the body. Never leaks internal error details.
 *
 * No rate limiting (uptime monitors call this every ~30s).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const timestamp = new Date().toISOString();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("clinics")
            .select("id", { head: true, count: "exact" })
            .limit(1);
          if (error) {
            return Response.json(
              { status: "degraded", error: "db_unreachable", timestamp },
              { status: 200 },
            );
          }
          return Response.json({ status: "ok", timestamp }, { status: 200 });
        } catch {
          return Response.json(
            { status: "degraded", error: "db_unreachable", timestamp },
            { status: 200 },
          );
        }
      },
    },
  },
});
