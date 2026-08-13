# ClinicFlow — Deployment Guide

This guide covers deploying ClinicFlow in two parts:

1. **Backend** → Supabase (database, auth, storage, RLS policies)
2. **Frontend / SSR app** → Vercel (TanStack Start app + server functions)

The two are independent: you provision Supabase first, then point the Vercel deployment at it via environment variables.

---

## Part 1 — Supabase (Backend)

ClinicFlow uses Supabase for Postgres, Auth, Storage, and Row-Level Security. There is **no** Supabase Edge Function in this project — all server logic runs as TanStack `createServerFn` handlers on Vercel.

### 1.1 Create the project

1. Sign in at <https://supabase.com> → **New project**.
2. Pick a region close to your users (e.g. `ap-south-1` for India).
3. Save the **database password** in a password manager — you will not see it again.
4. Wait for provisioning (~2 min).

### 1.2 Collect credentials

From **Project Settings → API** copy:

| Value                          | Used as env var                                    |
| ------------------------------ | -------------------------------------------------- |
| Project URL                    | `SUPABASE_URL` and `VITE_SUPABASE_URL`             |
| `anon` / publishable key       | `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `service_role` key (**secret**) | `SUPABASE_SERVICE_ROLE_KEY`                       |
| Project ref (in URL)            | `VITE_SUPABASE_PROJECT_ID`                        |

> ⚠️ Never expose `service_role` to the browser. It bypasses RLS.

### 1.3 Apply database migrations

Install the Supabase CLI: <https://supabase.com/docs/guides/cli>

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This runs every file in `supabase/migrations/` in order, creating tables, RLS policies, triggers, and the `bootstrap_first_super_admin`, `has_role`, `get_rls_status`, etc. functions.

Verify:

```bash
supabase db remote commit --dry-run   # should be a no-op
```

### 1.4 Configure Auth

In **Authentication → Providers**:

- **Email**: enable. Disable "Confirm email" only if you want instant sign-up; production should leave it on.
- **Google** (recommended): enable, paste OAuth client ID + secret from Google Cloud Console. Add this to *Authorized redirect URIs* in Google:
  ```
  https://<project-ref>.supabase.co/auth/v1/callback
  ```

In **Authentication → URL Configuration**:

- **Site URL**: `https://your-domain.com` (your Vercel domain)
- **Redirect URLs**: add both
  ```
  https://your-domain.com/**
  http://localhost:8080/**
  ```

Disable anonymous sign-ups.

### 1.5 Create storage buckets

In **Storage**, create three **public** buckets:

- `clinic-covers`
- `clinic-gallery`
- `clinic-logos`

(Migrations don't create buckets — do this in the dashboard once.)

### 1.6 Bootstrap the first super admin

1. Deploy the frontend first (Part 2 below).
2. Visit `https://your-domain.com/superadmin/login`.
3. Sign in with `priyabrata.dutta.slg@gmail.com` (the allow-listed email — change in `bootstrap_first_super_admin` SQL function + the Zod schema if you need a different one).
4. The flow self-seals after the first super admin is created.

### 1.7 Optional: secrets for SMS / notifications

If you wire a real SMS provider (Twilio, MSG91, Gupshup), add their keys under **Project Settings → Edge Functions → Secrets**, or — since this app runs on Vercel — as Vercel environment variables instead. See Part 2.

---

## Part 2 — Vercel (Frontend + SSR)

ClinicFlow is a TanStack Start app. Vercel deploys it as a serverless Node app with SSR + server functions.

### 2.1 Push the repo to GitHub

```bash
git remote add origin git@github.com:<you>/clinicflow.git
git push -u origin main
```

### 2.2 Import into Vercel

1. <https://vercel.com/new> → **Import Git Repository** → pick the repo.
2. **Framework Preset**: *Other* (Vercel auto-detects Vite/TanStack Start).
3. **Build Command**: `bun run build` (or `npm run build` if you don't use Bun).
4. **Output Directory**: leave default — TanStack Start's Vite plugin emits the correct output.
5. **Install Command**: `bun install` (or `npm install`).
6. **Node version**: 20.x.

### 2.3 Environment variables

Add these under **Project Settings → Environment Variables** (set for *Production*, *Preview*, and *Development*):

#### Public (browser-visible — prefixed `VITE_`)

| Name                            | Value                                    |
| ------------------------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`             | `https://<ref>.supabase.co`              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key                   |
| `VITE_SUPABASE_PROJECT_ID`      | project ref                              |

#### Server-only (never `VITE_`)

| Name                          | Value                                    |
| ----------------------------- | ---------------------------------------- |
| `SUPABASE_URL`                | same as `VITE_SUPABASE_URL`              |
| `SUPABASE_PUBLISHABLE_KEY`    | same as `VITE_SUPABASE_PUBLISHABLE_KEY`  |
| `SUPABASE_SERVICE_ROLE_KEY`   | **secret** — service role key            |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL` | e.g. `priyabrata.dutta.slg@gmail.com`    |

Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive** in Vercel.

If you use SMS/notifications, add provider keys here as well (e.g. `TWILIO_AUTH_TOKEN`, `MSG91_AUTH_KEY`).

### 2.4 First deployment

Click **Deploy**. Vercel will:

1. Run install + build.
2. Publish to `https://<project>.vercel.app`.

### 2.5 Update Supabase Auth URLs

After the first deploy, go back to Supabase → **Authentication → URL Configuration** and replace the placeholder Site URL with the actual Vercel URL (or your custom domain).

Also update Google OAuth *Authorized redirect URIs* if you added Google sign-in:
```
https://<ref>.supabase.co/auth/v1/callback
```
(unchanged — still points at Supabase, not Vercel) plus your custom domain in *Authorized JavaScript origins*.

### 2.6 Custom domain

In Vercel → **Settings → Domains**, add `your-domain.com`. Follow the DNS instructions (CNAME / A record). Vercel issues the TLS cert automatically.

Then update Supabase Site URL + Redirect URLs once more to use the custom domain.

### 2.7 Verify

- `https://your-domain.com/` loads the marketing/landing page.
- `https://your-domain.com/auth` lets you sign in.
- `https://your-domain.com/superadmin/login` shows the bootstrap flow on a fresh project.
- Open DevTools → Network: server-function calls to `/_serverFn/*` return 200.

---

## Part 3 — Going forward

### Updating the database

Add a new migration file under `supabase/migrations/`, then:

```bash
supabase db push
```

Re-deploy Vercel only if app code changed.

### Updating the app

```bash
git push origin main
```

Vercel auto-deploys on push. Preview deployments are created for every PR.

### Rotating the service role key

1. Supabase dashboard → **Settings → API → Rotate `service_role`**.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel → redeploy.

### Rollback

Vercel → **Deployments** → pick a previous build → **Promote to Production**. Database migrations cannot be auto-rolled back; write a forward migration that reverts the change.

---

## Troubleshooting

| Symptom                                              | Fix                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `Unsupported provider` on Google sign-in             | Enable Google provider in Supabase Auth.                             |
| `Unauthorized: No authorization header provided`     | Confirm `src/start.ts` registers `attachSupabaseAuth`.               |
| Server function returns 500, logs show `process.env.X is undefined` | Env var missing in Vercel for the current environment.    |
| Browser sees `permission denied for table ...`       | Missing `GRANT` in migration. Add `GRANT ... TO authenticated`.      |
| Public page works locally, blank on Vercel SSR       | A protected serverFn is being called from a public loader — move the call into a component with `useServerFn` + `useQuery`. |
| Super admin bootstrap link 404s                      | App not deployed yet, or route file `src/routes/superadmin/login.tsx` missing. |

---

**That's it.** Supabase holds the data; Vercel runs the app. Keep service-role keys in Vercel only, never in client code.
