// Daily sweep that queues subscription-expiry reminders and account-suspended
// emails. Called by pg_cron with the standard `apikey` header. Idempotency
// keys in `email_send_log` mean re-running this is harmless — the dispatcher
// silently skips anything it has already sent.
//
// SECURITY: this is a public-prefix route; we still gate on the anon apikey
// so random callers from the internet cannot trigger sends.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/email-expiry-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchEmail, loadEmailSettings } =
          await import("@/lib/notifications/email-dispatcher.server");

        const settings = await loadEmailSettings();
        if (!settings.enabled) {
          return new Response(JSON.stringify({ ok: true, skipped: "email_disabled" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const summary = {
          expiryQueued: 0,
          expirySkipped: 0,
          suspendedQueued: 0,
          suspendedSkipped: 0,
        };

        // ---- Expiry reminders -------------------------------------------
        if (settings.events.subscription_expiry) {
          const now = new Date();
          for (const offset of settings.expiryReminderDays) {
            // Target the day starting `offset` days from now (UTC).
            const dayStart = new Date(now);
            dayStart.setUTCHours(0, 0, 0, 0);
            dayStart.setUTCDate(dayStart.getUTCDate() + offset);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
            const bucket = dayStart.toISOString().slice(0, 10); // YYYY-MM-DD

            const { data: clinics } = await supabaseAdmin
              .from("clinics")
              .select("id, name, email, expires_at, is_active")
              .gte("expires_at", dayStart.toISOString())
              .lt("expires_at", dayEnd.toISOString())
              .eq("is_active", true);

            for (const c of clinics ?? []) {
              if (!c.email) continue;
              const r = await dispatchEmail({
                event: "subscription_expiry",
                to: c.email,
                idempotencyKey: `subscription_expiry:${c.id}:${bucket}:${offset}d`,
                clinicId: c.id,
                props: {
                  managerName: c.name ?? "there",
                  clinicName: c.name ?? "your clinic",
                  expiryDate: new Date(c.expires_at!).toDateString(),
                  daysRemaining: offset,
                  renewalUrl: `${process.env.APP_URL ?? ""}/superadmin`,
                },
              });
              if (r.status === "sent") summary.expiryQueued++;
              else summary.expirySkipped++;
            }
          }
        }

        // ---- Account suspended (newly expired or flipped inactive) -----
        if (settings.events.account_suspended) {
          const nowIso = new Date().toISOString();
          // Inactive OR expired clinics (within last 30 days of expiry so we
          // don't spam years-old data). Dedup key per clinic guarantees
          // exactly one send.
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: clinics } = await supabaseAdmin
            .from("clinics")
            .select("id, name, email, expires_at, is_active")
            .or(`is_active.eq.false,expires_at.lt.${nowIso}`)
            .gte("expires_at", cutoff);

          for (const c of clinics ?? []) {
            if (!c.email) continue;
            const r = await dispatchEmail({
              event: "account_suspended",
              to: c.email,
              idempotencyKey: `account_suspended:${c.id}`,
              clinicId: c.id,
              props: {
                managerName: c.name ?? "there",
                clinicName: c.name ?? "your clinic",
                reason: c.is_active === false ? "Account deactivated" : "Subscription expired",
                contactUrl: `${process.env.APP_URL ?? ""}/`,
              },
            });
            if (r.status === "sent") summary.suspendedQueued++;
            else summary.suspendedSkipped++;
          }
        }

        return new Response(JSON.stringify({ ok: true, ...summary }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
