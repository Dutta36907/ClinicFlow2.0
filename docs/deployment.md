# Deployment Guide

ClinicFlow ships in two halves:

- **Frontend / SSR app** → **Vercel** (TanStack Start + server functions)
- **Backend** → **Supabase** (Postgres, Auth, Storage, RLS)

This is the short, opinionated guide. For full step-by-step with screenshots and troubleshooting, see [`../DEPLOYMENT.md`](../DEPLOYMENT.md) at the repo root.

---

## Quick-start checklist

1. [ ] Create Supabase project and copy URL + keys.
2. [ ] `supabase link --project-ref <ref>` then `supabase db push`.
3. [ ] Configure Auth (Site URL, Redirect URLs, providers).
4. [ ] Create storage buckets: `clinic-covers`, `clinic-gallery`, `clinic-logos`.
5. [ ] Push repo to GitHub.
6. [ ] Import on Vercel → set env vars → deploy.
7. [ ] Update Supabase Site URL + Redirect URLs to the Vercel domain.
8. [ ] Visit `/superadmin/login` to bootstrap the first super admin.

---

## Local development

Running `bun dev` against the live Supabase project requires the same server-only env vars Vercel uses. Your local `.env` must include:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # required for super-admin screens
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

### Why the service role key matters locally

Super-admin-only server functions (`listClinicsForSuperAdmin`, system users, audit log, etc.) use the admin client, which needs `SUPABASE_SERVICE_ROLE_KEY`. **Without it, the Clinics tab, System Users, and other super-admin screens will appear empty** even though login works and your role rows exist in the database.

Everything else — patient booking, clinic manager dashboard, appointments, doctors, public clinic pages — runs through `requireSupabaseAuth` (RLS as the signed-in user) and works fine without the service role key.

### Why you can log in locally even without a role row

`auth.users` (login) and `public.user_roles` (permissions) are two different things. Login succeeds against the shared Supabase project as long as the user exists in Auth. If the signed-in account has no matching `user_roles` row, every dashboard will be empty — that's expected, not a bug.

> ⚠️ Never commit `.env`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or `VITE_*` variables.

---


## Backend — Supabase

ClinicFlow uses Supabase only for data, auth, and storage. **No Edge Functions** — all server logic runs as TanStack `createServerFn` handlers on Vercel.

### Provision

1. <https://supabase.com> → **New project**, pick a region near your users.
2. Save the DB password.
3. From **Project Settings → API**, grab:
   - Project URL
   - `anon` / publishable key
   - `service_role` key (**secret — never ship to browser**)
   - Project ref

### Migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This runs everything in `supabase/migrations/` — tables, RLS, GRANTs, triggers, and helper functions (`has_role`, `bootstrap_first_super_admin`, `get_rls_status`, …).

### Auth

In **Authentication → Providers**:
- Enable **Email** (leave email confirmation ON for production).
- Enable **Google**: paste OAuth client ID/secret; add `https://<ref>.supabase.co/auth/v1/callback` to authorized redirect URIs in Google Cloud Console.
- Disable anonymous sign-ups.

In **Authentication → URL Configuration**:
- **Site URL**: your Vercel/custom domain.
- **Redirect URLs**: `https://your-domain.com/**` and `http://localhost:8080/**`.

### Storage

Create three **public** buckets in the dashboard: `clinic-covers`, `clinic-gallery`, `clinic-logos`. Migrations don't create buckets.

### Bootstrap super admin

After the frontend is deployed, visit `/superadmin/login` and sign in with the allow-listed email (`priyabrata.dutta.slg@gmail.com` by default — change in `bootstrap_first_super_admin` SQL function + Zod schema if needed). The flow self-seals after the first super admin.

---

## Frontend — Vercel

### Import

1. Push repo to GitHub.
2. <https://vercel.com/new> → import the repo.
3. Settings:
   - **Framework Preset**: Other
   - **Build Command**: `bun run build`
   - **Install Command**: `bun install`
   - **Output Directory**: leave default (the included `vercel.json` handles routing)
   - **Node version**: 20.x

The repo ships a `vercel.json` that wires `dist/client` static assets, the `api/index.js` SSR function, security headers, and CSP. Don't override unless you know why.

### Environment variables

Set all of these for **Production**, **Preview**, and **Development**:

#### Public (browser-visible — must be prefixed `VITE_`)

| Name                            | Value                                |
| ------------------------------- | ------------------------------------ |
| `VITE_SUPABASE_URL`             | `https://<ref>.supabase.co`          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key               |
| `VITE_SUPABASE_PROJECT_ID`      | project ref                          |

#### Server-only (NEVER prefix with `VITE_`)

| Name                          | Value                                | Notes                |
| ----------------------------- | ------------------------------------ | -------------------- |
| `SUPABASE_URL`                | same as `VITE_SUPABASE_URL`          |                      |
| `SUPABASE_PUBLISHABLE_KEY`    | same as `VITE_SUPABASE_PUBLISHABLE_KEY` |                   |
| `SUPABASE_SERVICE_ROLE_KEY`   | service role key                     | Mark **Sensitive**   |
| `APP_URL`                     | your live domain                     |                      |
| `NODE_ENV`                    | `production`                         |                      |

SMS / WhatsApp / Email provider credentials are configured at **runtime** via the Super Admin Settings UI (stored in `platform_settings`), not env vars.

### First deploy

Click **Deploy**. You'll get `https://<project>.vercel.app`. Then:

1. Go back to Supabase → Auth → URL Configuration and replace the Site URL with the live Vercel URL.
2. Visit the deploy and verify `/`, `/auth`, and `/superadmin/login` all load and `/_serverFn/*` returns 200.

### Custom domain

Vercel → **Settings → Domains** → add `your-domain.com` and follow the DNS instructions. After DNS resolves, update Supabase Site URL + Redirect URLs again to use the custom domain.

---

## Day-2 operations

| Task                           | How                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Ship app code                  | `git push origin main` → Vercel auto-deploys. PRs get preview deploys.                    |
| Ship a DB change               | Add a new file in `supabase/migrations/`, run `supabase db push`.                         |
| Rotate `service_role`          | Supabase → Settings → API → Rotate, then update Vercel env + redeploy.                    |
| Rollback frontend              | Vercel → Deployments → Promote a previous build.                                          |
| Rollback DB                    | Write a forward migration that reverts. Migrations don't auto-rollback.                   |

---

## Common gotchas

| Symptom                                            | Fix                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `Unsupported provider` on Google sign-in           | Enable Google provider in Supabase Auth.                             |
| `Unauthorized: No authorization header provided`   | Ensure `src/start.ts` registers `attachSupabaseAuth` middleware.     |
| Server fn 500 with `process.env.X is undefined`    | Missing env var in Vercel for the current environment.               |
| `permission denied for table ...` in browser       | Missing `GRANT` in the migration. Add `GRANT ... TO authenticated`.  |
| Public page works locally, blank on Vercel SSR     | Protected serverFn called from a public loader — move into a component with `useServerFn` + `useQuery`. |
| `/superadmin/login` 404s                           | App not deployed, or route file missing under `src/routes/`.         |

---

**Rule of thumb:** Supabase owns the data; Vercel runs the app. Service-role keys stay in Vercel env (Sensitive), never in client code.
