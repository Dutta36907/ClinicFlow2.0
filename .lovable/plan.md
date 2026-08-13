## Diagnosis

I verified your database and code. Here's exactly what's happening.

### 1. Your roles are safe
The `user_roles` table has all 4 super admins (including `priyabrata.dutta.slg@gmail.com`, `devesh@appadd.in`, `info@appadd.in`, `manager@appadd.in`) plus 7 clinic manager rows. **Nothing is deleted.** Roles live in the Supabase database — the frontend host (Lovable, Vercel, localhost) does not own them.

### 2. Why login works locally without "seeing" a role
Supabase Auth (`auth.users`) and app roles (`public.user_roles`) are two different things:
- **Auth** lets you sign in. Your account exists in Supabase, so login succeeds from any host.
- **Roles** decide what you see. If your local browser is signed in as a user who has no role row (or as a super_admin whose token isn't reaching the server), the dashboards look empty even though login worked.

### 3. Why clinics are empty locally but appointments + doctors show
Your local `.env` only contains:
```
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_*
```
It is **missing `SUPABASE_SERVICE_ROLE_KEY`**.

- `listClinicsForSuperAdmin` uses the admin client (service role) → without the key, the server function crashes → UI shows zero clinics.
- Appointments and doctors are read via `requireSupabaseAuth` (RLS as the signed-in user), which only needs the publishable key → they work fine locally.

This is also why production works: Lovable Cloud injects the service role key on the server. Localhost does not have it unless you add it manually.

---

## Plan to fix local dev (and what it means for Vercel)

### Step 1 — Add the missing key locally
Add to your local `.env` (do NOT commit):
```
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
Lovable Cloud users cannot fetch this from the Lovable UI. The service role key is only retrievable from the Supabase project owner's account. If you don't have access, your local dev will work for everything **except** super-admin-only screens (clinics list, system users, etc.). Patient booking, clinic manager flows, appointments, doctors all still work without it.

### Step 2 — Confirm which account you're signed in as locally
Open DevTools → Application → Local Storage on localhost:8080, find the `sb-…-auth-token` entry, copy the email. If it's not one of the 4 super admin emails above, sign out and sign back in as `priyabrata.dutta.slg@gmail.com`. That alone explains "I can log in but see nothing".

### Step 3 — How this maps to Vercel hosting
Same model, no data migration:

| Concern | What happens |
|---|---|
| User roles | Stay in Supabase. Untouched. |
| Clinics, doctors, appointments, enquiries | Stay in Supabase. Untouched. |
| Auth sessions | Tied to Supabase project, not to Lovable. Users stay signed in. |
| Frontend code | Vercel runs the same Vite build. |
| Env vars | Set the same 6 vars in Vercel (3 `VITE_*` public, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). |
| Supabase Auth Site URL | Must be updated from `*.lovable.app` to your Vercel domain after first deploy. |
| Storage buckets | Already exist (`clinic-covers`, `clinic-gallery`, `clinic-logos`). Untouched. |
| RLS policies, functions, triggers | Already applied to the live DB. Untouched. |

The full step-by-step is already in `docs/deployment.md` and `DEPLOYMENT.md`. Nothing about migration deletes roles or data — both files live in the database, and the database does not move.

### Step 4 — One safety improvement I recommend
In `listClinicsForSuperAdmin` (and the other admin-client server functions), add a clear error when `SUPABASE_SERVICE_ROLE_KEY` is missing instead of crashing silently. That way "empty clinics list" becomes a visible "Service role key not configured on this environment" toast — no more guessing.

---

## What I will do when you approve
1. Update `docs/deployment.md` with a "Local dev requires SUPABASE_SERVICE_ROLE_KEY for super-admin screens" callout.
2. Add a friendly error in the admin server-function helper so missing service role on any environment surfaces immediately in the UI.
3. No DB changes. No role changes. No data changes.

Approve and I'll apply only those two small changes.