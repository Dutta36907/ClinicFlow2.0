# Architecture Guide

A high-level map of the codebase, written for developers who are new to
this project. If you only read one doc, read this one — then jump to
[`ADDING-A-FEATURE.md`](./ADDING-A-FEATURE.md) when you're ready to ship
something.

---

## 1. The stack in one paragraph

This app is built on **TanStack Start** (React 19 + Vite 7) with
**file-based routing**, **TanStack Query** for data fetching, **Tailwind
v4** for styling, and **Supabase** for the database, auth, and storage.
All server-side logic is written as
**TanStack server functions** (`createServerFn`) — there are *no* Supabase
Edge Functions in this project.

---

## 2. Folder map

```
src/
├── routes/                       ← every URL is a file here
│   ├── __root.tsx                  shared <html> shell + providers
│   ├── index.tsx                   /                (public landing)
│   ├── $slug.tsx                   /:slug           (clinic landing + booking)
│   ├── $slug_.clinicmanager.tsx    /:slug/clinicmanager  (manager dashboard, public link)
│   ├── _authenticated/             pathless layout — requires login
│   │   └── $slug.manage.tsx        /:slug/manage    (authenticated manager)
│   ├── login.tsx                   auth page
│   ├── privacy.tsx, terms.tsx      static legal pages (linked from footer)
│   ├── superadmin.*.tsx            super-admin console
│   └── api/public/                 server routes (health, future webhooks)
│
├── components/
│   ├── ui/                       ← shadcn primitives — don't edit by hand
│   ├── booking/                    public booking dialog (see §4)
│   ├── clinicmanager/              clinic manager dashboard (see §3)
│   │   ├── sections.tsx              ↳ barrel that re-exports all sections
│   │   ├── sections/                 ↳ one file per dashboard section
│   │   ├── shared/                   ↳ layout + form primitives
│   │   ├── types.ts                  ↳ DashboardClinic / DashboardDoctor / AppointmentRow
│   │   └── ManagerSidebar.tsx
│   └── superadmin/                 super-admin views
│
├── lib/                          ← framework-agnostic helpers
│   ├── *.functions.ts              TanStack server functions (client-callable RPCs)
│   ├── *.server.ts                 server-only helpers (never imported from client)
│   ├── notifications/              dispatcher + providers + React Email templates (see §4.5)
│   ├── sms/                        SMS provider abstraction (dev / twilio / msg91 / gupshup)
│   ├── clinic-time.ts              12-hour time formatters
│   ├── doctor-slots.ts             15-min slot generator
│   └── utils.ts                    cn() etc.
│
├── integrations/supabase/        ← AUTO-GENERATED — never edit
│   ├── client.ts                   browser Supabase client
│   ├── client.server.ts            admin (service-role) client
│   ├── auth-middleware.ts          requireSupabaseAuth
│   ├── auth-attacher.ts            attaches bearer token to serverFn calls
│   └── types.ts                    DB types
│
├── hooks/                        ← reusable React hooks
├── styles.css                    ← Tailwind v4 + design tokens (oklch)
├── router.tsx                    ← TanStack Router setup
└── start.ts                      ← server entry — registers middleware

supabase/
└── migrations/                   ← SQL migrations (one file per change)

docs/
├── ARCHITECTURE.md               ← you are here
└── ADDING-A-FEATURE.md           ← copy-paste recipes
```

---

## 3. Clinic manager dashboard

The dashboard lives at `/:slug/clinicmanager` (public manager link) and
`/:slug/manage` (authenticated). Both routes render the same sections via
`ManagerSidebar` + a section component picked by the active tab.

```
src/components/clinicmanager/
├── sections.tsx          ← barrel: re-exports everything below
├── types.ts              ← shared TypeScript types
├── ManagerSidebar.tsx    ← left-rail navigation
├── shared/
│   ├── SectionShell.tsx    page wrapper (title + subtitle + Card)
│   ├── FormPrimitives.tsx  Field / Grid / Sub label
│   ├── days.ts             weekday helpers + clinicHoursToSchedule
│   └── tz-format.ts        formatNice / tzDayStart / tzDateKey
└── sections/
    ├── OverviewSection.tsx      stats + booking link
    ├── ProfileSection.tsx       edit clinic profile
    ├── WorkingHoursSection.tsx  clinic open/closed hours (display only)
    ├── DoctorsSection.tsx       doctor CRUD + working hours + time-off
    ├── DashboardSection.tsx     today's queue with realtime updates
    ├── AppointmentsSection.tsx  filterable appointment list
    ├── AppointmentDialogs.tsx   detail sheet + edit dialog + slot validator
    ├── SettingsSection.tsx      per-doctor slot interval config
    └── TeamSection.tsx          invite / remove team members (RBAC)
```

**Rule of thumb:** each section file owns its own data fetching
(`useSuspenseQuery` over a server function), local state, and render
logic. Nothing in `sections/` should import from another section — share
through `shared/` or `types.ts` instead.

---

## 4. Public booking flow

`/:slug` → `src/routes/$slug.tsx` renders `ClinicLanding`. The "Book"
button opens a multi-step dialog defined under
`src/components/booking/` (date+time → details → verify → done).

The dialog uses the 15-minute slot grid from
`src/lib/doctor-slots.ts` — see the `doctor_settings` table for the
`slot_minutes` override per doctor.

---

## 4.5 Notifications

Every outbound SMS / WhatsApp / Email goes through one server-only entry
point: the **dispatcher** in `src/lib/notifications/`. No template, trigger
point, or component sends directly — that's how masking and the per-tier
toggles stay enforceable.

```text
trigger (e.g. createAppointment)
    │
    ▼
dispatcher.server.ts
    │
    ├─ 1. platform_settings.notifications.enabled?           ── no → skip + log
    ├─ 2. clinic.notify_<channel>?                            ── no → skip + log
    ├─ 3. clinic.notify_patient_<event>_<channel>?            ── no → skip + log
    ├─ 4. provider configured + enabled in platform_settings? ── no → skip + log
    ├─ 5. recipient present (phone/email)?                    ── no → skip + log
    └─ 6. maskPhone / maskEmail / sanitiseTemplateData
            │
            ▼
       provider adapter (msg91 / interakt / resend)
            │
            ▼
       notification_log  (recipient stored ALREADY masked)
```

- **Five events**: `appointment_booked`, `appointment_rescheduled`,
  `clinic_new_booking`, `new_clinic_welcome`, `subscription_expiry`.
- **Templates** live in `templates/sms/`, `templates/whatsapp/`, and
  `templates/email/` (React Email components).
- **Masking** is centralised in `mask.ts`: phone → `XXXXX<last5>`,
  email → `xx***@domain`. Templates assume the value is already masked.
- **Observability**: the Super Admin Notification Log view reads
  `notification_log` directly; search is "last 5 digits of phone" against
  the masked column.

---

## 5. Data flow

```
   Browser (React)                           Server (Worker)
   ──────────────                            ─────────────────
   useSuspenseQuery ─────► useServerFn ────► createServerFn handler
                                                │
                                                ├─ requireSupabaseAuth
                                                │   (sets context.userId)
                                                │
                                                └─ supabase.from(...).select()
                                                        │
                                                        ▼
                                                  Postgres (RLS enforced)
```

- **Read shape:** loader does `queryClient.ensureQueryData(...)`,
  component reads with `useSuspenseQuery(...)`.
- **Writes:** wrap a server function in `useServerFn(...)`, call from a
  mutation handler, then `queryClient.invalidateQueries(...)`.
- **Realtime:** the dashboard subscribes to `postgres_changes` on
  `appointments` and re-runs the query on every event.

---

## 6. Styling rules

- Use semantic tokens defined in `src/styles.css` (`bg-background`,
  `text-foreground`, `bg-primary`, etc.). **Do not** hard-code colors
  like `bg-white` or `text-gray-700` in components.
- The token palette is defined in `oklch`. To add a new token, append it
  to `:root` and `.dark` in `src/styles.css`.
- Time strings are always rendered through `formatTime12` /
  `formatRange12` from `src/lib/clinic-time.ts`. Never concatenate
  `"HH:mm" + "–" + "HH:mm"` directly in a component.

---

## 7. Files you must never edit by hand

- `src/integrations/supabase/types.ts` — regenerate via
  `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`
  after a schema change, don't hand-edit.
- `src/routeTree.gen.ts` (regenerated by TanStack Router)
- `.env` — per-machine/per-environment, never committed (see `.env.example`)
- `supabase/config.toml` project-level keys

If `routeTree.gen.ts` looks out of date, restart the dev server — it
regenerates automatically. The rest of `src/integrations/supabase/*`
(`client.ts`, `client.server.ts`, `auth-middleware.ts`) is regular
hand-maintained source.
