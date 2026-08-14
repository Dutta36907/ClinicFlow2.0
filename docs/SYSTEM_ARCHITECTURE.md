# System Architecture

> Living reference for the BookMyClinic platform. Written to be portable: any
> future developer or LLM should be able to read this file and understand the
> system without first reading every source file. If the frontend is ever
> rewritten (for example in Next.js), Sections 4 and 15 are the contract to
> follow.

Last reviewed: 2026-06-25

---

## 1. Overview

BookMyClinic is a multi-tenant SaaS for outpatient clinics. Each clinic gets
a public landing page at `/<clinic-slug>`, lets patients book appointments
with individual doctors, and gives the clinic staff a manager dashboard to
run day-to-day operations. A single super-admin console oversees every
clinic on the platform.

### Primary actors

| Actor           | Auth state                                                                                             | Entry point             | Capabilities                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| Patient (guest) | Unauthenticated                                                                                        | `/<slug>`               | Browse doctors, view slots, book / reschedule / cancel appointments via on-screen OTP |
| Clinic Manager  | Supabase user with `clinic_members` row                                                                | `/<slug>/clinicmanager` | Manage doctors, schedules, overrides, appointments, page content, media, enquiries    |
| Super Admin     | Supabase user with `user_roles.role = 'super_admin'` and `super_admin_permissions.is_disabled = false` | `/superadmin`           | Manage clinics, plans, platform settings, email config, security scans                |

### Core domains

- **Tenancy** — clinics, clinic members, plans, suspensions.
- **Scheduling** — doctors, weekly availability, slot overrides, appointments.
- **Identity** — Supabase Auth + role table + clinic membership table.
- **Communication** — Resend email, on-screen OTP today (SMS provider pluggable).
- **Content** — clinic landing page content, media library (logo, cover, gallery).

---

## 2. High-level architecture

```text
                        ┌────────────────────────────┐
                        │         Browser            │
                        │  (React 19 client + SSR)   │
                        └──────────────┬─────────────┘
                                       │ HTTPS
                                       ▼
              ┌────────────────────────────────────────────┐
              │      Frontend (Cloudflare Workers)         │
              │  TanStack Start v1 — SSR + RPC + API       │
              │                                            │
              │  src/routes/*.tsx        page routes       │
              │  src/routes/api/*        public HTTP API   │
              │  src/lib/*.functions.ts  createServerFn    │
              └────────┬────────────────────────┬──────────┘
                       │ Supabase JS            │ HTTPS
                       │ (publishable + JWT)    │ (service role,
                       ▼                        │  server only)
              ┌──────────────────────┐          │
              │   Supabase (Cloud)   │◄─────────┘
              │  Postgres + RLS      │
              │  Auth (email/Google) │
              │  Storage (buckets)   │
              │  pg_cron (reminders) │
              └──────────┬───────────┘
                         │ HTTPS
                         ▼
                ┌──────────────────┐
                │  Resend (email)  │
                └──────────────────┘
```

All app-internal calls go through the framework. Webhooks, cron callbacks
and any future third-party-callable endpoints live under `/api/public/*`.

---

## 3. Tech stack (current)

Each row lists the **role** so a swap-out target is obvious.

| Role               | Current choice                                           | Notes                                                  |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| SSR framework      | TanStack Start v1 (React 19)                             | Replaceable with Next.js App Router — see §15          |
| Build tool         | Vite 7                                                   | Replaced together with the framework                   |
| Runtime            | Cloudflare Workers (`nodejs_compat`)                     | Edge runtime; not full Node — see §9 caveats           |
| UI                 | React 19 + Tailwind v4 + shadcn/ui                       | Tailwind tokens defined in `src/styles.css`            |
| Forms / validation | react-hook-form + Zod                                    | Zod schemas shared between client and server functions |
| Data fetching      | TanStack Query (in router context)                       | Loader hydrates → `useSuspenseQuery` reads             |
| Database           | Postgres (Supabase)                                      | RLS enabled on every public table                      |
| Auth               | Supabase Auth                                            | Email/password + Google OAuth                          |
| Storage            | Supabase Storage                                         | One bucket per clinic-owned asset class                |
| Scheduling         | `pg_cron` extension                                      | Daily reminder sweep                                   |
| Email              | Resend                                                   | API key stored as platform setting (encrypted)         |
| SMS / OTP          | On-screen code (default), Twilio/MSG91/Gupshup pluggable | Provider is a `platform_settings` value                |
| Hosting (frontend) | Vercel                                                   | See `docs/deployment.md`                               |
| Hosting (backend)  | Supabase                                                 | Managed                                                |

---

## 4. Frontend-agnostic contract

Any frontend implementation must provide the following surface. If this list
is satisfied, the rest of the system (DB, auth, email, business logic)
continues to work unchanged.

1. **Server-side rendering** for public routes — patient landing pages must
   be crawlable. Loaders must run on the server.
2. **Authenticated session bridge** — the Supabase access token must be
   attached as a Bearer header on every server-to-server call that uses the
   `requireSupabaseAuth` middleware. The browser publishable client must
   persist sessions in `localStorage` under the project's auth key.
3. **Server call surface** — every function in `src/lib/*.functions.ts` is
   either typed RPC (`createServerFn`) or maps cleanly to a Next.js Server
   Action / Route Handler. The pure business logic should live in
   importable helpers separate from the framework wrapper.
4. **Public HTTP endpoints** — `app/routes/api/public/*` are stable URLs
   used by `pg_cron` and (future) webhooks. They must keep the same paths
   when the framework changes, or the cron jobs must be reconfigured.
5. **Environment variables** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   on the client; `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional — usually read
   from `platform_settings`) on the server. See `.env.example`.
6. **Route paths** — see §5. URLs are public contracts: patients bookmark
   clinic pages and Google indexes them.

---

## 5. Route map

### Public (no auth)

| Path                       | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `/`                        | Marketing landing                         |
| `/login`                   | Patient/manager sign-in                   |
| `/$slug`                   | Clinic public landing page (SSR, indexed) |
| `/$slug/doctors/$doctorId` | Doctor detail + booking entry             |
| `/privacy`, `/terms`       | Legal pages                               |
| `/sitemap.xml`             | Generated from active clinics             |

### Clinic Manager (authenticated, scoped to one clinic)

| Path                                     | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| `/$slug/clinicmanager`                   | Dashboard shell                       |
| `/$slug/clinicmanager/doctors/$doctorId` | Doctor editor                         |
| `/_authenticated/...`                    | Layout-gated subtree (prerender-safe) |

### Super Admin

| Path                 | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `/superadmin/login`  | Bootstrap-aware sign-in                          |
| `/superadmin`        | Clinics, plans, settings, security, email config |
| `/superadmin/logout` | Sign-out                                         |

### API (public HTTP)

| Path            | Purpose                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `/api/public/*` | Webhooks, cron callbacks. Must verify caller (signature or shared secret) inside the handler. |

---

## 6. Backend modules

All under `src/lib/`. `*.functions.ts` files are client-importable server
RPC; `*.server.ts` files never reach the browser bundle.

| Module                                     | Responsibility                                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.functions.ts`                      | Guest booking flow: list active clinics/doctors, slot availability, OTP issue/verify, create / reschedule / cancel appointment. Reads via `supabaseAdmin` with safe column projection. |
| `clinicmanager.functions.ts`               | Manager CRUD: doctors, weekly hours, overrides, appointments, enquiries. Gated by `is_clinic_member`.                                                                                  |
| `superadmin.functions.ts`                  | Clinic lifecycle, plan changes, suspensions, role grants. Gated by `has_role('super_admin')` + not-disabled.                                                                           |
| `dashboard.functions.ts`                   | Aggregated metrics for both manager and super-admin dashboards.                                                                                                                        |
| `media.functions.ts`                       | Upload / list / delete clinic media (logo, cover, gallery).                                                                                                                            |
| `pagecontent.functions.ts`                 | Clinic landing-page content (about, services, gallery layout).                                                                                                                         |
| `email-settings.functions.ts`              | Read/write Resend key, master switch, per-event toggles.                                                                                                                               |
| `notifications/email-dispatcher.server.ts` | Central email send with idempotency-key dedupe via `email_send_log`.                                                                                                                   |
| `notifications/templates/*`                | React Email templates.                                                                                                                                                                 |
| `sms/*`                                    | Pluggable OTP providers (`dev`/on-screen is default).                                                                                                                                  |
| `security-scan.{functions,server}.ts`      | In-app security scan surface.                                                                                                                                                          |
| `enquiries.functions.ts`                   | Patient enquiry inbox per clinic.                                                                                                                                                      |
| `validation/*`                             | Shared Zod schemas.                                                                                                                                                                    |

---

## 7. Data model

Core public-schema tables (every one has RLS enabled and explicit `GRANT`s).

| Table                                     | Purpose                                                                          | Read access                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `clinics`                                 | Tenant root. Slug, plan, status, contact, working hours.                         | Server-only via `supabaseAdmin` (safe columns)                            |
| `doctors`                                 | Clinic-scoped doctors, specialty, weekly availability JSON.                      | Server-only via `supabaseAdmin` (safe columns)                            |
| `doctor_slot_overrides`                   | Date-specific closures / extra hours. `reason` column is staff-only.             | Server-only, `reason` never exposed publicly                              |
| `appointments`                            | Bookings: patient name/phone, doctor, slot, status.                              | Manager (own clinic), patient (via signed access not stored), super admin |
| `user_roles`                              | `(user_id, role)` — separate from profile table to prevent privilege escalation. | `authenticated` SELECT for `has_role`                                     |
| `super_admin_permissions`                 | `is_disabled` toggle per super-admin user.                                       | `has_role` / `is_clinic_member` consult it                                |
| `clinic_members`                          | `(user_id, clinic_id)` membership for clinic managers.                           | Member + super admin                                                      |
| `email_send_log`                          | Idempotency-key store; dedupes notification sends.                               | Service role only                                                         |
| `email_settings` (in `platform_settings`) | Resend key, master switch, per-event toggles.                                    | Super admin via server fn                                                 |
| `platform_settings`                       | Key-value config: OTP provider, SMS keys, email config.                          | Super admin                                                               |
| `enquiries`                               | Patient enquiries from public clinic page.                                       | Manager + super admin                                                     |
| `clinic_page_content`                     | Landing page content per clinic.                                                 | Public read of safe columns via server fn                                 |

### Patterns enforced everywhere

- **Roles never on the user/profile row.** Use `user_roles` + `has_role`.
- **Every `CREATE TABLE public.*` ships GRANTs in the same migration.**
- **Security-definer helpers** (`has_role`, `is_clinic_member`,
  `bootstrap_first_super_admin`) wrap cross-table reads to avoid RLS recursion.
- **No `select("*")` in public-facing server functions** — only safe columns.

---

## 8. Auth & access control

### Three Supabase clients (do not mix)

| Client              | Where                                                          | Auth context               | Use for                                                                          |
| ------------------- | -------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Browser publishable | `src/integrations/supabase/client.ts`                          | Logged-in user (persisted) | UI auth flows, realtime, session listeners                                       |
| Server publishable  | Constructed in server fn handler                               | Anon (no session)          | Future public reads that go through narrow `TO anon` policies                    |
| Server admin        | `src/integrations/supabase/client.server.ts` (`supabaseAdmin`) | Service role, BYPASSES RLS | Trusted server logic, projecting safe columns for public reads, admin operations |

The `supabaseAdmin` import is filename-gated (`.server.ts`) from client bundles
and must be loaded inside handler bodies in `*.functions.ts` files.

### Access gates

```text
public → server fn → supabaseAdmin (safe cols) → DB
clinic manager → requireSupabaseAuth → is_clinic_member(uid, clinic) → DB
super admin → requireSupabaseAuth → has_role(uid,'super_admin') AND NOT is_disabled → DB
```

`requireSupabaseAuth` is a server-function middleware. It depends on a
client-side `functionMiddleware` in `src/start.ts` that attaches the Supabase
bearer token to outgoing RPC calls. Removing or skipping that middleware
breaks every authenticated server function with a 401.

### Bootstrap

First super admin is self-sealing: `/superadmin/login` shows a bootstrap UI
only when zero super-admins exist. The DB function
`bootstrap_first_super_admin(_user_id, _email)` has a `WHERE NOT EXISTS` race
guard and only accepts a hard-coded primary email (`priyabrata.dutta.slg@gmail.com`).
After the first super-admin exists, the bootstrap path is permanently closed.

---

## 9. Server function pattern

### `createServerFn` (app-internal RPC)

```ts
// src/lib/<domain>.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const doThing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // `context.supabase` is scoped to the calling user — RLS applies.
    // For privileged work, dynamically import the admin client:
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // ...
  });
```

### `/api/public/*` (HTTP endpoints)

```ts
// src/routes/api/public/<name>.ts
export const Route = createFileRoute("/api/public/<name>")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* verify, then act */
      },
    },
  },
});
```

### Runtime caveats (Cloudflare Workers)

- No `child_process`, no `sharp`/`canvas`/`puppeteer`, no `fs.watch`.
- Image optimisation happens client-side before upload (`src/lib/image-optimize.ts`).
- `process.env.X` is undefined at module scope — read it inside `.handler()`.
- Never call a `requireSupabaseAuth` server fn from a public-route loader:
  SSR / `build:dev` prerender runs without a session and the build fails.

---

## 10. Booking flow (sequence)

```text
Patient                Frontend                   Server fn               DB / Email
   │                      │                           │                       │
   │ open /<slug>         │                           │                       │
   │─────────────────────▶│ loader: getPublicClinic   │                       │
   │                      │──────────────────────────▶│  supabaseAdmin select │
   │                      │◀──────────────────────────│  (safe cols only)     │
   │ pick doctor + slot   │                           │                       │
   │─────────────────────▶│ getDoctorAvailability     │                       │
   │                      │──────────────────────────▶│  hours + overrides    │
   │ enter details        │                           │                       │
   │─────────────────────▶│ requestPatientOtp         │                       │
   │                      │──────────────────────────▶│  provider = "dev" →   │
   │                      │◀── { devCode }            │  return code in body  │
   │ enter OTP            │                           │                       │
   │─────────────────────▶│ createAppointment         │                       │
   │                      │──────────────────────────▶│  verify OTP, insert,  │
   │                      │                           │  email-dispatcher     │
   │                      │                           │  ──▶ Resend (idemp.)  │
   │ confirmation         │◀──────────────────────────│                       │
```

Reschedule and cancel reuse the same OTP gate.

---

## 11. Email system

- **Dispatcher**: `src/lib/notifications/email-dispatcher.server.ts`.
- **Dedupe**: every send computes an idempotency key (event + entity + version);
  `email_send_log` stores it. Repeated calls become no-ops, so retries and
  webhook replays do not double-send.
- **Provider**: Resend. API key stored as a `platform_settings` row, editable
  from Super Admin → Settings → Email.
- **Toggles**: master switch + per-event toggle for each notification type:
  clinic created, appointment booked, appointment rescheduled, appointment
  cancelled, plan nearing expiry, account suspended.
- **Scheduled sweeps**: `pg_cron` runs a daily job that calls an
  `/api/public/cron/*` endpoint to fan out expiry/suspension reminders. The
  endpoint must verify a shared secret in the request header.

If the master switch is off, the dispatcher short-circuits before any API
call — no spend, no log row.

---

## 12. Storage

| Asset          | Bucket           | Dimensions (recommended)   | Max upload                    |
| -------------- | ---------------- | -------------------------- | ----------------------------- |
| Clinic logo    | `clinic-logos`   | 512×512 px (square)        | 20 MB (optimised client-side) |
| Clinic cover   | `clinic-covers`  | 1920×480 px (wide banner)  | 20 MB                         |
| Clinic gallery | `clinic-gallery` | 1600×1200 px (4:3 typical) | 20 MB, multi-select           |
| Doctor photo   | `doctor-photos`  | 512×512 px                 | 20 MB                         |

The unified upload dialog (`MediaLibraryDialog`) handles browsing existing
assets and uploading new ones. Images are downscaled / re-encoded in the
browser before upload — no server-side image processing exists.

---

## 13. Security posture

- **RLS-first.** Every public-schema table has RLS enabled and explicit
  `GRANT`s. A table without grants is unreachable by PostgREST regardless of
  policies — checks are belt-and-suspenders.
- **No `anon` SELECT on tenant data.** Public reads go through server
  functions that use `supabaseAdmin` and project only safe columns
  (`reason` on overrides, internal plan/notification fields on clinics, etc.
  are never returned to anonymous callers).
- **Role table separation.** Roles live in `user_roles`, never on profiles.
  `super_admin_permissions.is_disabled` is consulted by every helper.
- **Security-definer functions are locked down.** `EXECUTE` revoked from
  `PUBLIC`; re-granted to `authenticated` only for the helpers RLS needs at
  evaluation time; admin-only helpers grant `EXECUTE` to `service_role` only.
- **`createServerFn` without auth = public endpoint.** Treat unauthenticated
  server fns as a public API surface and validate inputs accordingly.
- **Secrets handling.** Service role key and DB password are not exposed.
  Webhook endpoints must verify signatures before processing.

Always read `mem://security/security-memory` before changing access policies.

---

## 14. Environments & deployment

| Layer                       | Host                  | Config source                          |
| --------------------------- | --------------------- | -------------------------------------- |
| Frontend                    | Vercel                | Project env vars (Vercel dashboard)    |
| Backend (DB, Auth, Storage) | Supabase              | Managed; secrets via platform settings |
| Cron                        | `pg_cron` in Postgres | Migration-managed                      |

Env vars are split by exposure:

| Variable                        | Where                           | Why                                       |
| ------------------------------- | ------------------------------- | ----------------------------------------- |
| `VITE_SUPABASE_URL`             | Client + server                 | Public; baked into bundle                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client + server                 | Public; RLS still applies                 |
| `SUPABASE_URL`                  | Server only                     | Same value, server context                |
| `SUPABASE_PUBLISHABLE_KEY`      | Server only                     | For anon-context server reads             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only — **never** shipped | Bypasses RLS                              |
| `RESEND_API_KEY`                | Optional (DB-stored by default) | Used if env wins over `platform_settings` |
| `WEBHOOK_SECRET`                | Server only                     | Verifies `/api/public/*` callers          |

See `docs/deployment.md` and `.env.example` for the full list.

---

## 15. Migration notes — TanStack Start → Next.js (App Router)

Use this as a checklist when porting the frontend. The backend (Supabase
schema, RLS, helpers, Resend, cron) does not change.

### Direct mappings

| TanStack Start                                       | Next.js App Router                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/routes/__root.tsx` (`shellComponent`)           | `app/layout.tsx`                                                       |
| `src/routes/index.tsx`                               | `app/page.tsx`                                                         |
| `src/routes/$slug.tsx`                               | `app/[slug]/page.tsx`                                                  |
| `src/routes/$slug.doctors.$doctorId.tsx`             | `app/[slug]/doctors/[doctorId]/page.tsx`                               |
| `src/routes/_authenticated.tsx` (layout gate)        | `app/(authenticated)/layout.tsx` + `middleware.ts`                     |
| `src/routes/api/public/*.ts`                         | `app/api/public/*/route.ts` (keep URL identical)                       |
| Loader + `useSuspenseQuery`                          | RSC `await` in the page component, or `generateMetadata` for head data |
| `createServerFn` (RPC)                               | Server Action (`"use server"`) or Route Handler                        |
| `requireSupabaseAuth` middleware                     | Server-side helper that reads the Supabase session from cookies        |
| `attachSupabaseAuth` client middleware               | Not needed — Server Actions read cookies directly                      |
| `head()` per route                                   | `export const metadata` or `generateMetadata`                          |
| `Link` / `useNavigate` from `@tanstack/react-router` | `Link` from `next/link`, `useRouter` from `next/navigation`            |

### What stays identical

- The entire Postgres schema, RLS, helper functions, triggers, `pg_cron` jobs.
- `src/lib/notifications/*` — pure logic, framework-agnostic.
- `src/lib/validation/*` — Zod schemas.
- React Email templates.
- shadcn/ui components and Tailwind tokens (`src/styles.css` → `app/globals.css`).
- Image optimisation helpers (`src/lib/image-optimize.ts`).
- Business logic inside `*.functions.ts` files — extract the handler body
  into a pure async function and call it from both the existing server fn
  and the future Server Action.

### Recommended pre-port refactor

Before the port, split each `xxx.functions.ts` into two files:

```text
src/lib/<domain>/logic.ts        ← pure: takes inputs + supabase client, returns data
src/lib/<domain>/<domain>.functions.ts  ← thin createServerFn wrapper
```

Then the Next.js port only needs new wrappers — the logic ports as-is.

### Gotchas

- Supabase Auth session storage differs between client-side `localStorage`
  (current) and cookie-based SSR sessions (recommended for Next.js). Use
  `@supabase/ssr` for cookie session management.
- `/api/public/*` paths must remain stable; `pg_cron` references them by
  absolute URL.
- The bootstrap email allowlist is enforced in the DB function, not the
  frontend — porting cannot remove it.

---

## 16. Glossary

| Term             | Meaning                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| RLS              | Row-Level Security. Postgres policies that decide which rows a role can read/write.              |
| Security definer | A function that runs with its owner's privileges, used to bypass RLS recursion in helper checks. |
| Idempotency key  | A unique string per logical action; used here to dedupe email sends across retries.              |
| SSR              | Server-Side Rendering — HTML produced on the server, required for SEO on public pages.           |
| Edge runtime     | Cloudflare Workers (V8 isolate). Lighter than Node, with some APIs stubbed or missing.           |
| Service role     | Supabase API key that bypasses RLS. Server-only, never shipped to the browser.                   |
| Publishable key  | Public Supabase key. Safe in the browser; RLS still enforces access.                             |
| Server function  | `createServerFn` — typed RPC from client to server with input validation and middleware.         |
| Bootstrap        | One-time setup path for the first super admin, sealed after success.                             |
| Tenant           | A single clinic. Tenant isolation is enforced by `clinic_id` + RLS.                              |
| OTP              | One-Time Passcode used to verify the patient phone number before booking.                        |
| pg_cron          | Postgres extension that runs scheduled SQL or HTTP calls inside the database.                    |

---

## Appendix: important disclosures

- **First super-admin email** is hard-coded to `priyabrata.dutta.slg@gmail.com`
  in both the Zod schema and the SQL bootstrap function. Changing the owner
  requires a migration and a code change.
- **OTP plaintext** is returned in the HTTP response **only** when the SMS
  provider is `dev` (on-screen). Production SMS providers must never return
  the code in the response body.
- **`select("*")` in any public-facing server function is a regression** —
  it has previously leaked the `doctor_slot_overrides.reason` column. Always
  enumerate safe columns.
- **`super_admin_permissions.is_disabled`** must be checked in both
  `has_role` and `is_clinic_member` paths, or a disabled super-admin
  regains tenant access through the membership branch.
- **Webhook / cron endpoints under `/api/public/*`** bypass auth on the
  published site. They MUST verify a signature or shared secret before
  doing any work.
- **`src/integrations/supabase/*`** files (`client.ts`, `client.server.ts`,
  `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`) are auto-generated.
  Do not edit them by hand — changes are overwritten.
- **No service-role key in the browser, ever.** Dynamic import of
  `client.server.ts` from `.functions.ts` files only — and only inside the
  handler body, never at module scope.
