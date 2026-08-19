# First super-admin bootstrap

One-time flow to create the platform's first `super_admin` account. Public,
unauthenticated by necessity (no admin exists yet to authenticate against) —
so it's gated by a secret instead.

## Flow

1. Visit `/superadmin/login`. `getSignupStatus` checks whether any
   `super_admin` row exists; if none does, the page shows the **setup** form
   instead of the sign-in form.
2. The setup form asks for: full name, password (12+ chars), and a
   **setup token**. Email is fixed — the form pre-fills it and it's read-only.
3. Submitting calls `bootstrapFirstSuperAdmin` (`src/lib/superadmin.functions.ts`),
   which is gated two ways before it touches Supabase:
   - **Setup token** — must match the `BOOTSTRAP_SETUP_TOKEN` env var, compared
     with `timingSafeEqual`. This is the real gate: the token is a server-only
     secret, never shipped to the client.
   - **Email allowlist** — must equal the hardcoded `ALLOWED_BOOTSTRAP_EMAIL`
     constant in that same file. This alone is *not* a secret (it's visible in
     the client bundle), which is why the token exists — see "Why a token"
     below.
4. On success, the DB function `bootstrap_first_super_admin` (Postgres,
   `SECURITY DEFINER`) does the actual insert atomically: `WHERE NOT EXISTS
   (SELECT 1 FROM user_roles WHERE role = 'super_admin')`, so concurrent
   callers can't both win. It independently re-checks the email too.
5. The path is then permanently sealed — every later call returns
   `{ bootstrapped: false, reason: 'super_admin_exists' }`, regardless of
   token or email. There's no env var or override to reopen it.

## Why a token (history)

The original design only checked the allowed email. That email is hardcoded
in `superadmin.login.tsx` and shipped in the public JS bundle — readable by
anyone via devtools, not a secret. Combined with
`auth.admin.createUser({ email_confirm: true })` (no inbox verification),
this meant *anyone* who read the bundle could race the real owner: POST first
with that email and a password of their own choosing, and win the account —
no proof of owning the inbox required.

The setup token closes that gap. Even knowing the allowed email is useless
without also knowing `BOOTSTRAP_SETUP_TOKEN`, which never leaves the server.

## Getting the token

The token is **not committed to this repo** (it's a live secret in a public
repository — see `.gitignore`'s treatment of `.env*` for the same policy).
It lives only as a Vercel environment variable:

- Vercel dashboard → project `clinicflow-preprod` → Settings → Environment
  Variables → `BOOTSTRAP_SETUP_TOKEN` (Production), **or**
- `vercel env pull --environment=production` from a machine with access to
  the linked Vercel project.

If you need a fresh one (e.g. redeploying a new environment from scratch):

```sh
openssl rand -hex 32
```

then set it as `BOOTSTRAP_SETUP_TOKEN` in that environment's Vercel project
settings (regular/"Non-sensitive" type — see the note in `CI_CD_SETUP.md`
about why "Sensitive"-type vars break this repo's CLI-driven build).

## Notes

- Bootstrap fails closed: if `BOOTSTRAP_SETUP_TOKEN` isn't set at all,
  `bootstrapFirstSuperAdmin` always rejects, regardless of what token is
  submitted.
- Rotating the token after a successful bootstrap is unnecessary — the path
  is already sealed by then and the token stops mattering — but harmless if
  you want to anyway (e.g. before handing off Vercel project access).
