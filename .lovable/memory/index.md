---
name: index
description: Project memory index
type: reference
---
# Project Memory

## Core
- OTP plaintext codes must NEVER be returned in HTTP responses for production SMS providers. The `dev` provider returns the code as `devCode` ONLY when BOTH `sent.provider === "dev"` AND `process.env.NODE_ENV !== "production"`. Both gates are required.
- Super admin bootstrap is a one-time self-sealing flow on /superadmin/login, gated by zero existing super_admins. Use bootstrapFirstSuperAdmin server fn; DB function bootstrap_first_super_admin(_user_id uuid, _email text) has WHERE NOT EXISTS race guard.
- First super admin email is restricted to `priyabrata.dutta.slg@gmail.com`. Enforced in both the Zod schema (server fn) and the SQL function.
- Public getSignupStatus exposes only { bootstrapMode: boolean } — never any email or other identifying info.
- All assertSuperAdmin / assertClinicAccess helpers must check super_admin_permissions.is_disabled on the super-admin branch.
- Clinic slug is immutable for clinic managers (enforced by `prevent_clinic_slug_change` BEFORE UPDATE trigger). Only super admins (has_role) can rename. updateClinic in superadmin.functions.ts writes an audit_log row on every clinic update.
- Public-read RLS on clinic_treatments / clinic_testimonials / clinic_gallery requires the parent clinic to be active and not expired (EXISTS subquery). Do not relax to plain USING(true).
- Image uploads (ImageUploader, MediaLibraryDialog): strict MIME allowlist {jpeg, png, webp}. SVG is rejected because it can carry embedded scripts served from our origin.
- getClientIp priority: cf-connecting-ip → x-real-ip → first X-Forwarded-For entry. Never trust XFF first on Cloudflare.
- resetSystemUserPassword requires caller.can_users AND target must exist in super_admin_permissions (system users only — never use to reset clinic-manager passwords; use setClinicManagerPassword for that).
