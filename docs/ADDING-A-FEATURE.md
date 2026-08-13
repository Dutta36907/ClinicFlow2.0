# Adding a Feature — Recipes

Copy-paste-friendly walkthroughs for the most common changes. Each
recipe assumes you've read [`ARCHITECTURE.md`](./ARCHITECTURE.md).

> Golden rule: **make the smallest change that works**. Add files,
> don't bloat existing ones. If a file goes over ~400 lines, split it.

---

## Recipe 1 — Add a new section to the clinic manager dashboard

Goal: a new tab in the left sidebar (e.g. "Reports") that renders its
own page.

### 1. Create the section file

```tsx
// src/components/clinicmanager/sections/ReportsSection.tsx
import { SectionShell, Card } from "../shared/SectionShell";
import type { DashboardClinic } from "../types";

/**
 * Reports — placeholder example.
 * Add data fetching with useSuspenseQuery + a server function.
 */
export function ReportsSection({ clinic }: { clinic: DashboardClinic }) {
  return (
    <SectionShell
      title="Reports"
      subtitle="Monthly summaries for your clinic."
    >
      <Card>
        <p className="text-sm text-muted-foreground">
          Reports for <strong>{clinic.name}</strong> will appear here.
        </p>
      </Card>
    </SectionShell>
  );
}
```

### 2. Re-export from the barrel

Open `src/components/clinicmanager/sections.tsx` and add:

```ts
export { ReportsSection } from "./sections/ReportsSection";
```

### 3. Add a sidebar entry

In `src/components/clinicmanager/ManagerSidebar.tsx`, add `"reports"`
to the `ManagerSection` union and append a nav item with an icon.

### 4. Render the section in the route(s)

In `src/routes/$slug_.clinicmanager.tsx` and
`src/routes/_authenticated/$slug.manage.tsx`, import `ReportsSection`
and add a branch in the `section === "..."` switch.

Done — the new tab appears.

---

## Recipe 2 — Add a server function (RPC)

Server functions are typed RPCs your React components can call. They
run on the Worker, not in the browser.

```ts
// src/lib/reports.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ clinicId: z.string().uuid() });

export const getMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("appointments")
      .select("id, status, appointment_at")
      .eq("clinic_id", data.clinicId);
    if (error) throw error;
    return { rows };
  });
```

Call it from a component:

```tsx
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getMonthlyReport } from "@/lib/reports.functions";

function ReportPanel({ clinicId }: { clinicId: string }) {
  const fetchReport = useServerFn(getMonthlyReport);
  const { data } = useSuspenseQuery({
    queryKey: ["report", clinicId],
    queryFn: () => fetchReport({ data: { clinicId } }),
  });
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

> Don't put a protected serverFn in a public route's `loader` — SSR has
> no session and the call will 401 the build. Either move it inside a
> component (`useQuery`), or place the route under `_authenticated/`.

---

## Recipe 3 — Add a new database table

1. **Write a migration** under `supabase/migrations/`:

```sql
-- supabase/migrations/<timestamp>_create_reports.sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  period text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- REQUIRED: grant Data API access (RLS alone is not enough)
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;

alter table public.reports enable row level security;

create policy "Clinic members can read reports"
on public.reports for select to authenticated
using (
  exists (
    select 1 from public.clinic_members m
    where m.clinic_id = reports.clinic_id and m.user_id = auth.uid()
  )
);
```

2. Run it against each environment: `supabase db push` (see `docs/CI_CD_SETUP.md`).
3. Wait for `src/integrations/supabase/types.ts` to regenerate — never
   edit that file by hand.

---

## Recipe 4 — Add a step to the public booking dialog

Open `src/components/booking/` and:

1. Add the new step to the `Step` union type.
2. Create a new step component (e.g. `PaymentStep.tsx`) that takes the
   shared `state` + `setState` props the others use.
3. Wire it into the `<DialogStepper />` switch and the `BackBtn` flow.
4. If it needs to save data, hit a server function via `useServerFn`.

Keep one step per file. If a step grows past 150 lines, split it.

---

## Recipe 5 — Add a token to the design system

Open `src/styles.css` and append the variable in both `:root` and
`.dark`:

```css
:root {
  --report-accent: oklch(0.72 0.15 195);
}
.dark {
  --report-accent: oklch(0.82 0.12 195);
}

@theme inline {
  --color-report-accent: var(--report-accent);
}
```

Then use `bg-report-accent` / `text-report-accent` in components. Do
not introduce ad-hoc hex colors in JSX.

---

## Recipe 6 — Add a webhook endpoint

```ts
// src/routes/api/public/stripe-webhook.ts
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!)
          .update(body)
          .digest("hex");
        if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return new Response("Invalid signature", { status: 401 });
        }
        // ... handle event using supabaseAdmin
        return new Response("ok");
      },
    },
  },
});
```

`/api/public/*` bypasses auth in production — **always verify the
signature**.

---

## Recipe 7 — Send a notification from a server function

All outbound SMS / WhatsApp / Email go through the dispatcher in
`src/lib/notifications/`. Never call a provider adapter directly, and
never put a patient phone number into a template variable yourself — the
dispatcher applies `maskPhone` / `maskEmail` before any provider payload
or `notification_log` row is written.

```ts
// inside any server function, after you've done your real work
import { dispatchNotification } from "@/lib/notifications/dispatcher.server";

await dispatchNotification({
  event: "appointment_booked",              // one of 5 event keys
  clinicId,                                  // drives per-clinic + per-event toggles
  recipient: {
    phone: patientPhone,                     // raw — dispatcher masks it
    email: patientEmail ?? undefined,
  },
  templateData: {
    clinicName,
    doctorName,
    date,                                    // strings only — no PII keys
    time,
    appointmentId,
  },
});
```

The dispatcher resolves the 6-tier precedence (platform → clinic →
event → provider → recipient → masking), picks the configured provider
from `platform_settings`, and writes one `notification_log` row per
attempt (success, skip, or failure). The call is fire-and-forget from
the caller's perspective; never block the user response on it.

> The dispatcher and `notifications.functions.ts` admin RPCs are
> implemented in the notifications module turn. Until then, the
> providers, templates, and `mask.ts` exist but the funnel isn't wired —
> see `src/lib/notifications/`.

---

## Where to put what — cheat sheet

| You're adding…                       | Put it in…                                    |
|--------------------------------------|-----------------------------------------------|
| A new page (URL)                     | `src/routes/<path>.tsx`                       |
| A dashboard section                  | `src/components/clinicmanager/sections/`      |
| A reusable form input                | `src/components/clinicmanager/shared/` or `src/components/ui/` |
| A booking-dialog step                | `src/components/booking/`                     |
| A super-admin view                   | `src/components/superadmin/views/`            |
| A typed RPC                          | `src/lib/<feature>.functions.ts`              |
| A server-only helper (no client use) | `src/lib/<feature>.server.ts`                 |
| A webhook                            | `src/routes/api/public/<name>.ts`             |
| A DB schema change                   | `supabase/migrations/<timestamp>_<name>.sql`  |
| A design token                       | `src/styles.css`                              |
| A notification template              | `src/lib/notifications/templates/<channel>/`  |
| A notification provider adapter      | `src/lib/notifications/providers/<name>.server.ts` |
