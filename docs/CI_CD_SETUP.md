# CI/CD Setup — Preproduction & Production

One GitHub repo, two long-lived branches, two Supabase projects, two Vercel
projects, GitHub Actions as the gate. This doc is the checklist — follow it
top to bottom once, then jump to **Day-2 workflow** for how you ship after
that.

```
feature branch → PR → preproduction branch → PR → main branch
                          │                          │
                       CI workflow                CI workflow
                          │ (on success)              │ (on success)
                  Deploy Preproduction         Deploy Production
                          │                          │
              Vercel project "clinicflow-preprod"   Vercel project "clinicflow-prod"
                          │                          │
              Supabase project "clinicflow-preprod"  Supabase project "clinicflow-prod"
```

Config already in this repo: `.github/workflows/ci.yml`,
`.github/workflows/deploy-preprod.yml`, `.github/workflows/deploy-main.yml`.
Read them before you start — they tell you exactly which secrets each step
needs.

---

## Part 1 — GitHub repo & branches

```bash
cd ClinicFlow-2.0
git init
git add -A
git commit -m "Initial commit"
git branch -M main
```

Create the GitHub repo (empty, no README/license — you already have files):

```bash
gh repo create <your-org>/clinicflow --private --source=. --remote=origin
git push -u origin main
```

No `gh` CLI? Create the repo on github.com, then:

```bash
git remote add origin git@github.com:<your-org>/clinicflow.git
git push -u origin main
```

Create `preproduction` from `main`:

```bash
git checkout -b preproduction
git push -u origin preproduction
```

From now on: feature branches → PR into `preproduction` → merge → PR
`preproduction` into `main` → merge. Never push directly to either — branch
protection in Part 5 will enforce this.

---

## Part 2 — Supabase: two projects

Repeat this entire section twice: once for `clinicflow-preprod`, once for
`clinicflow-prod`. Keep a scratch note of the four values you collect per
project — you'll need them in Parts 3 and 4.

1. [supabase.com](https://supabase.com) → **New project** → name it
   `clinicflow-preprod` (then later `clinicflow-prod`). Pick the same region
   for both (e.g. `ap-south-1`). Save the DB password somewhere safe.
2. **Project Settings → API** — copy:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon`/publishable key → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - Project ref (in the URL, e.g. `abcxyz123`) → `VITE_SUPABASE_PROJECT_ID`
3. **Project Settings → Database → Connection string** (URI, direct
   connection, not pooler) — this is `SUPABASE_DB_URL`. Substitute the DB
   password you saved in step 1.
4. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   (Or skip the CLI locally and let the `deploy-*.yml` workflows do this —
   your call. Doing it once manually now lets you verify the schema before
   wiring up Actions.)
5. **Authentication → Providers**: enable Email; enable Google if you use
   it (paste OAuth client ID/secret, add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized
   redirect URI in Google Cloud Console). Disable anonymous sign-ups.
6. **Authentication → URL Configuration**: Site URL and Redirect URLs —
   leave placeholder for now, you'll set the real Vercel domain here after
   Part 3.
7. **Storage** → create three **public** buckets: `clinic-covers`,
   `clinic-gallery`, `clinic-logos`.

Do this twice. You'll end up with two full sets of the four Supabase values
above — one preprod, one prod. Do not cross-wire them.

---

## Part 3 — Vercel: two projects, same repo

Both projects point at the **same** GitHub repo, but each tracks a
different branch as its Production Branch, and each gets its own env vars.

### Project A — `clinicflow-preprod`

1. [vercel.com/new](https://vercel.com/new) → import your GitHub repo.
2. Name it `clinicflow-preprod`.
3. **Framework Preset**: Other. **Build Command**: `bun run build`.
   **Install Command**: `bun install`. Leave Output Directory default —
   `vercel.json` already wires `dist/client` + `api/index.js`.
4. Deploy once (it'll fail without env vars — that's fine, fix next).
5. **Project Settings → Git → Production Branch** → set to `preproduction`.
6. **Project Settings → Environment Variables** — add the preprod Supabase
   values from Part 2, scoped to **Production** (this project's only
   "production" is your preproduction environment):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_URL` = this project's `https://clinicflow-preprod.vercel.app` (or your custom preprod domain)
   - `NODE_ENV` = `production`
   - `BOOTSTRAP_SETUP_TOKEN` = a random secret (`openssl rand -hex 32`) — required
     once, to claim the first super admin at `/superadmin/login`
   - Leave every variable's type as the default (**do not** mark them
     "Sensitive" — that type can't be decrypted by `vercel pull`/`vercel build`,
     which the deploy workflow relies on, and silently breaks the build)
7. Redeploy (Deployments tab → ⋯ → Redeploy) so the new env vars take effect.

### Project B — `clinicflow-prod`

Repeat steps 1–7: name it `clinicflow-prod`, **Production Branch** =
`main`, env vars = the prod Supabase project's values, `APP_URL` = your
real production domain (custom domain if you have one).

### Get the values GitHub Actions needs

```bash
npm i -g vercel
vercel login
vercel link   # run once inside the repo, pick clinicflow-preprod when prompted
cat .vercel/project.json   # → orgId, projectId
```

Note `orgId` (same for both projects) and this project's `projectId`. Run
`vercel link` again and pick `clinicflow-prod` to get its `projectId` too.
Get a deploy token from **Vercel → Account Settings → Tokens → Create**.
Delete `.vercel/` locally afterward — don't commit it.

---

## Part 4 — GitHub Actions secrets & environments

**Repo → Settings → Environments** — create two environments:
`preproduction` and `production`.

For `production`, turn on **Required reviewers** and add yourself — this
makes prod deploys wait for a manual click-to-approve after CI passes.
Optional but recommended.

**Repo → Settings → Secrets and variables → Actions**:

Repository secrets (shared by both environments):
| Name | Value |
|---|---|
| `VERCEL_TOKEN` | the token from Part 3 |
| `VERCEL_ORG_ID` | `orgId` from Part 3 |

Environment secrets — **preproduction**:
| Name | Value |
|---|---|
| `VERCEL_PROJECT_ID` | `clinicflow-preprod`'s `projectId` |
| `SUPABASE_DB_URL` | preprod project's DB connection string (Part 2) |

Environment secrets — **production**:
| Name | Value |
|---|---|
| `VERCEL_PROJECT_ID` | `clinicflow-prod`'s `projectId` |
| `SUPABASE_DB_URL` | prod project's DB connection string (Part 2) |

---

## Part 5 — Branch protection

**Repo → Settings → Branches** — add rules for both `main` and
`preproduction`:

- Require a pull request before merging (require at least 1 approval if
  you're not working solo).
- Require status checks to pass before merging → search for and require
  `CI / checks`.
- Do not allow bypassing the above (uncheck "Allow force pushes", disable
  direct pushes for everyone including yourself).

This is what actually stops broken code from reaching either branch — the
`workflow_run` gate in the deploy workflows is the second layer, for the
case where CI hasn't run yet or someone with bypass rights pushes directly.

---

## Part 6 — First deploy

1. Push a trivial change on a feature branch, open a PR into
   `preproduction`. Watch the `CI` check go green.
2. Merge. Watch **Actions** tab: `CI` runs on the push, then
   `Deploy Preproduction` fires automatically after it succeeds.
3. Visit `https://clinicflow-preprod.vercel.app/superadmin/login` → bootstrap
   the first super admin (self-sealing, one-time, gated to the email in
   `bootstrap_first_super_admin`).
4. Go back to Supabase (preprod project) → **Authentication → URL
   Configuration** → set Site URL to the real preprod Vercel domain now
   that you know it.
5. Smoke-test: sign in, create a test clinic, book a test appointment.
6. Once happy, PR `preproduction` → `main`. Merge → (approve the
   `production` environment gate if you enabled required reviewers) →
   `Deploy Production` runs. Repeat step 3–4 against the prod Supabase
   project and prod domain.

---

## Day-2 workflow

```
git checkout preproduction && git pull
git checkout -b feature/whatever
# ...make changes...
git push -u origin feature/whatever
# open PR into preproduction on GitHub
```

- PR into `preproduction` → CI must pass → merge → auto-deploys to
  preprod → verify there.
- PR `preproduction` into `main` → CI must pass → (approve if gated) →
  auto-deploys to prod.
- Database changes: add a new file under `supabase/migrations/`, commit it
  with the app change. The deploy workflow runs `supabase db push` against
  that environment's DB automatically before the app is deployed, so schema
  and code land together — no manual migration step per deploy.

## Troubleshooting

| Symptom                                         | Fix                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Deploy Preproduction` never fires after merge  | Check the `CI` workflow actually ran on that branch and succeeded — `workflow_run` only fires on completion, not on push directly.                                                                                 |
| Vercel build succeeds locally, fails in Actions | Missing/mismatched env vars in that Vercel project's **Production** environment — re-check Part 3 step 6.                                                                                                          |
| `supabase db push` fails in Actions             | `SUPABASE_DB_URL` env secret wrong/missing for that GitHub Environment, or the migration has already been applied manually and is out of sync — run `supabase db push --dry-run` locally against that DB to check. |
| Preprod and prod showing the same data          | You wired the same Supabase project into both Vercel projects — go back to Part 3 step 6 and fix the env vars for one of them.                                                                                     |
