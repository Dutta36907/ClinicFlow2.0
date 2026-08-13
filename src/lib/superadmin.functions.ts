import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Service role key is not configured on this server. Super-admin screens require SUPABASE_SERVICE_ROLE_KEY to be set in the environment (Vercel env vars, or local .env for development). Other features (login, booking, clinic manager) continue to work without it.",
    );
  }
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}


/**
 * Returns whether the app is in "bootstrap mode" (no super_admin exists yet).
 * Public — safe to call without auth. Exposes only a boolean; never any
 * configured email or other identifying info.
 */
export const getSignupStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabaseAdmin = await getAdmin();
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);
    return { bootstrapMode: (count ?? 0) === 0 };
  },
);

/**
 * One-time, self-sealing first-time setup. Creates the very first super admin
 * account when — and only when — no super_admin exists yet. After the first
 * success, every subsequent call returns
 * { bootstrapped: false, reason: 'super_admin_exists' } and the path is
 * permanently sealed. No env var, no override, no second chance.
 *
 * Unauthenticated by necessity (there is no admin yet). The DB function
 * inserts the role atomically with a WHERE NOT EXISTS guard, so concurrent
 * callers cannot both win.
 */
const ALLOWED_BOOTSTRAP_EMAIL = "priyabrata.dutta.slg@gmail.com";

const bootstrapSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(255)
    .refine((e) => e === ALLOWED_BOOTSTRAP_EMAIL, {
      message: "This email is not authorized to bootstrap a super admin.",
    }),
  password: z.string().min(12).max(72),
  fullName: z.string().trim().min(2).max(120),
});

export const bootstrapFirstSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    // Pre-flight: refuse if a super admin already exists. The DB function is
    // the source of truth (atomic) but this avoids creating an orphan auth
    // user when the path is hit after setup.
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if (countErr) throw new Error("Setup unavailable");
    if ((count ?? 0) > 0) {
      return { bootstrapped: false, reason: "super_admin_exists" as const };
    }

    const createRes = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createRes.error) throw new Error("Setup already complete");
    const userId = createRes.data.user?.id;
    if (!userId) throw new Error("Setup unavailable");

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
      "bootstrap_first_super_admin",
      { _user_id: userId, _email: data.email },
    );

    if (rpcErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error("Setup already complete");
    }

    const result = rpcRes as { bootstrapped: boolean; reason?: string };
    if (!result.bootstrapped) {
      // Race lost: another caller won. Clean up the orphan auth user.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return { bootstrapped: false, reason: "super_admin_exists" as const };
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName }, { onConflict: "id" });

    return { bootstrapped: true };
  });



async function assertSuperAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  // Single RPC round-trip replaces two serial queries (user_roles + super_admin_permissions).
  const { data, error } = await supabaseAdmin.rpc("get_user_auth_context", { _uid: userId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : (data as { is_super?: boolean; is_disabled?: boolean } | null);
  if (!row?.is_super) throw new Error("Not authorized");
  if (row.is_disabled) throw new Error("Your account is disabled");
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Lenient URL field for clinic profile inputs (website, google_map_url).
 *
 * Many existing clinic records were saved before strict URL validation
 * landed, so the stored value may be a bare host like "maps.app.goo.gl/xyz"
 * or "example.com". A strict `.url()` rejected those rows and blocked
 * unrelated edits (e.g. flipping `is_active`). We auto-prepend `https://`
 * when the scheme is missing, then validate. Genuine garbage (text with
 * spaces, etc.) still fails.
 */
function optionalNormalizedUrl(max: number, label: string) {
  return z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      if (!t) return "";
      return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
    },
    z
      .string()
      .max(max, { message: `${label} is too long` })
      .url({ message: `${label} is not a valid URL` })
      .or(z.literal("")),
  );
}

export const checkSlugAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(2).max(60),
        excludeId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const slug = data.slug.toLowerCase();
    if (!slugRe.test(slug)) return { available: false, reason: "invalid" as const };
    let q = supabaseAdmin.from("clinics").select("id").eq("slug", slug).limit(1);
    if (data.excludeId) q = q.neq("id", data.excludeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { available: !rows || rows.length === 0, reason: null };
  });

const createClinicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).regex(slugRe),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  website: optionalNormalizedUrl(500, "Website URL"),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  google_map_url: optionalNormalizedUrl(1000, "Google Maps URL"),
  is_active: z.boolean(),
  expires_at: z.string().datetime().nullable(),
  manager_full_name: z.string().trim().min(2).max(120),
  manager_email: z.string().trim().email().max(255),
  manager_password: z.string().min(8).max(72),
});

export const createClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createClinicSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const slug = data.slug.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", slug)
      .limit(1);
    if (existing && existing.length > 0) throw new Error("Slug already taken");

    const { data: row, error } = await supabaseAdmin
      .from("clinics")
      .insert({
        name: data.name,
        slug,
        phone: data.phone || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        website: data.website || null,
        address: data.address || null,
        google_map_url: data.google_map_url || null,
        is_active: data.is_active,
        expires_at: data.expires_at,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    const clinicId = row.id as string;
    const managerEmail = data.manager_email.trim().toLowerCase();

    try {
      let userId: string | null = null;
      let created = false;
      let existed = false;

      const createRes = await supabaseAdmin.auth.admin.createUser({
        email: managerEmail,
        password: data.manager_password,
        email_confirm: true,
        user_metadata: { full_name: data.manager_full_name },
      });

      if (createRes.error) {
        const msg = createRes.error.message?.toLowerCase() ?? "";
        const alreadyExists =
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists");
        if (!alreadyExists) throw new Error(createRes.error.message);

        const { data: foundId, error: lookupErr } = await supabaseAdmin.rpc(
          "get_user_id_by_email",
          { _email: managerEmail },
        );
        if (lookupErr) throw new Error(lookupErr.message);
        if (!foundId) throw new Error("Manager email exists but user not found");
        userId = foundId as string;
        existed = true;
      } else {
        userId = createRes.data.user?.id ?? null;
        created = true;
      }

      if (!userId) throw new Error("Failed to resolve manager user id");

      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: userId, full_name: data.manager_full_name },
          { onConflict: "id" },
        );

      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          clinic_id: clinicId,
          role: "clinic_manager",
        });
      if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
        throw new Error(roleErr.message);
      }

      // Fire-and-forget email notifications. Idempotency keys in the
      // dispatcher mean a retry of this server fn would not double-send.
      const { dispatchEmailSafe } = await import("./notifications/email-dispatcher.server");
      const appUrl = process.env.APP_URL ?? "";
      const loginUrl = `${appUrl}/login`;
      dispatchEmailSafe({
        event: "clinic_welcome",
        to: managerEmail,
        idempotencyKey: `clinic_welcome:${clinicId}`,
        clinicId,
        props: {
          managerName: data.manager_full_name,
          clinicName: data.name,
          clinicSlug: slug,
          loginUrl,
        },
      });
      if (created) {
        // Only send credentials when WE just created the auth user — never
        // re-send a password to an existing account.
        dispatchEmailSafe({
          event: "clinic_manager_invite",
          to: managerEmail,
          idempotencyKey: `clinic_manager_invite:${clinicId}:${userId}`,
          clinicId,
          props: {
            managerName: data.manager_full_name,
            clinicName: data.name,
            loginUrl,
            loginEmail: managerEmail,
            tempPassword: data.manager_password,
          },
        });
      }

      return {
        id: clinicId,
        slug: row.slug,
        manager: { email: managerEmail, created, existed },
      };
    } catch (e) {
      await supabaseAdmin.from("clinics").delete().eq("id", clinicId);
      throw e instanceof Error ? e : new Error("Failed to provision manager");
    }
  });

const updateClinicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(60).regex(slugRe),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  website: optionalNormalizedUrl(500, "Website URL"),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  google_map_url: optionalNormalizedUrl(1000, "Google Maps URL"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.boolean(),
  expires_at: z.string().datetime().nullable(),
});

export const updateClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateClinicSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const slug = data.slug.toLowerCase();

    const { data: clash } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", slug)
      .neq("id", data.id)
      .limit(1);
    if (clash && clash.length > 0) throw new Error("Slug already taken");

    // Defense in depth: only callers with can_subscriptions may mutate
    // is_active / expires_at. Otherwise we keep the existing row values.
    const { data: perms } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("can_subscriptions")
      .eq("user_id", context.userId)
      .maybeSingle();
    let effectiveIsActive = data.is_active;
    let effectiveExpiresAt = data.expires_at;
    if (!perms?.can_subscriptions) {
      const { data: current } = await supabaseAdmin
        .from("clinics")
        .select("is_active, expires_at")
        .eq("id", data.id)
        .maybeSingle();
      if (current) {
        effectiveIsActive = current.is_active;
        effectiveExpiresAt = current.expires_at;
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("clinics")
      .update({
        name: data.name,
        slug,
        phone: data.phone || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        website: data.website || null,
        address: data.address || null,
        google_map_url: data.google_map_url || null,
        description: data.description || null,
        is_active: effectiveIsActive,
        expires_at: effectiveExpiresAt,
      })
      .eq("id", data.id)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    // Audit: super-admin write on a clinic they don't own. Slug renames
    // pass through here too (the prevent_clinic_slug_change trigger lets
    // super admins through), so this is the only record of the change.
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      clinic_id: row.id,
      action: "clinic.update",
      target_type: "clinics",
      target_id: row.id,
      metadata: { slug: row.slug },
    });

    return { id: row.id, slug: row.slug };
  });

// ---- Clinic manager credentials (super admin only) ----

export const listClinicManagers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ clinic_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("clinic_id", data.clinic_id)
      .eq("role", "clinic_manager");
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id as string)));
    if (userIds.length === 0) return { managers: [] };

    const [{ data: profs }, { data: emails }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds),
      supabaseAdmin.rpc("get_emails_for_ids", { _ids: userIds }),
    ]);
    const nameById = new Map<string, string | null>();
    (profs ?? []).forEach((p) => nameById.set(p.id as string, (p.full_name as string | null) ?? null));
    const emailById = new Map<string, string | null>();
    ((emails ?? []) as Array<{ id: string; email: string | null }>).forEach((e) =>
      emailById.set(e.id, e.email ?? null),
    );

    const managers = userIds.map((uid) => ({
      user_id: uid,
      email: emailById.get(uid) ?? null,
      full_name: nameById.get(uid) ?? null,
    }));
    return { managers };
  });

export const setClinicManagerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        user_id: z.string().uuid(),
        password: z.string().min(6).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: role, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("clinic_id", data.clinic_id)
      .eq("user_id", data.user_id)
      .eq("role", "clinic_manager")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!role) throw new Error("User is not a manager of this clinic");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.user_id,
      { password: data.password },
    );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      clinic_id: data.clinic_id,
      action: "clinic_manager.password_reset",
      target_type: "auth.users",
      target_id: data.user_id,
    });

    return { ok: true };
  });

// ---- Customers (clinic owners) ----

export type Customer = {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  is_active: boolean;
  expires_at: string | null;
  activation_date: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
};

const listCustomersSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    status: z.enum(["all", "active", "inactive", "expired", "expiring"]).default("all"),
    search: z.string().trim().max(200).default(""),
  })
  .default({ page: 1, pageSize: 25, status: "all", search: "" });


export const listAllCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listCustomersSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ customers: Customer[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const nowIso = new Date().toISOString();
    const in30dIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let cq = supabaseAdmin
      .from("clinics")
      .select("id, name, slug, is_active, expires_at, created_at", { count: "exact" });

    if (data.status === "active") {
      cq = cq.eq("is_active", true);
      cq = cq.or(`expires_at.is.null,expires_at.gte.${nowIso}`);
    } else if (data.status === "inactive") {
      cq = cq.eq("is_active", false);
    } else if (data.status === "expired") {
      cq = cq.lt("expires_at", nowIso);
    } else if (data.status === "expiring") {
      cq = cq.eq("is_active", true).gt("expires_at", nowIso).lt("expires_at", in30dIso);
    }

    const term = data.search.trim();
    if (term) {
      const esc = term.replace(/[%,]/g, " ");
      cq = cq.or(`name.ilike.%${esc}%,slug.ilike.%${esc}%`);
    }

    const { data: clinics, error: cErr, count } = await cq
      .order("created_at", { ascending: false })
      .range(from, to);
    if (cErr) throw new Error(cErr.message);


    const clinicIds = (clinics ?? []).map((c) => c.id);
    const managerByClinic = new Map<string, string>();

    if (clinicIds.length > 0) {
      const { data: roles, error: rErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, clinic_id")
        .eq("role", "clinic_manager")
        .in("clinic_id", clinicIds);
      if (rErr) throw new Error(rErr.message);
      (roles ?? []).forEach((r) => {
        if (r.clinic_id && !managerByClinic.has(r.clinic_id)) {
          managerByClinic.set(r.clinic_id, r.user_id);
        }
      });
    }

    const userIds = Array.from(new Set(managerByClinic.values()));
    const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);
      (profiles ?? []).forEach((p) =>
        profileMap.set(p.id, { full_name: p.full_name, phone: p.phone }),
      );
    }

    const emailMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: emails } = await supabaseAdmin.rpc("get_emails_for_ids", {
        _ids: userIds,
      });
      ((emails ?? []) as Array<{ id: string; email: string | null }>).forEach((e) =>
        emailMap.set(e.id, e.email ?? null),
      );
    }

    const customers: Customer[] = (clinics ?? []).map((c) => {
      const uid = managerByClinic.get(c.id) ?? null;
      const prof = uid ? profileMap.get(uid) : undefined;
      return {
        clinic_id: c.id,
        clinic_name: c.name,
        clinic_slug: c.slug,
        is_active: c.is_active,
        expires_at: c.expires_at,
        activation_date: c.created_at,
        user_id: uid,
        email: uid ? (emailMap.get(uid) ?? null) : null,
        full_name: prof?.full_name ?? null,
        phone: prof?.phone ?? null,
      };
    });

    return { customers, total: count ?? 0 };
  });

/**
 * Quick activate/deactivate from the Clinics list. Touches ONLY `is_active`
 * (and resets `expires_at` to +365d when activating a clinic whose expiry
 * is missing or in the past). Does NOT revalidate `google_map_url`,
 * `website`, `email`, etc. — so a stale invalid value elsewhere on the row
 * can't block a status flip.
 */
export const setClinicActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clinicId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: perms } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("can_subscriptions")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!perms?.can_subscriptions) {
      throw new Error("You don't have permission to change subscription status");
    }

    const { data: current } = await supabaseAdmin
      .from("clinics")
      .select("id, expires_at")
      .eq("id", data.clinicId)
      .maybeSingle();
    if (!current) throw new Error("Clinic not found");

    const patch: { is_active: boolean; expires_at?: string | null } = {
      is_active: data.isActive,
    };
    if (data.isActive) {
      const currentExpiry = current.expires_at
        ? new Date(current.expires_at).getTime()
        : 0;
      if (!currentExpiry || currentExpiry < Date.now()) {
        const d = new Date();
        d.setDate(d.getDate() + 365);
        patch.expires_at = d.toISOString();
      }
    }

    const { error } = await supabaseAdmin
      .from("clinics")
      .update(patch)
      .eq("id", data.clinicId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      clinic_id: data.clinicId,
      action: data.isActive ? "clinic.activate" : "clinic.deactivate",
      target_type: "clinics",
      target_id: data.clinicId,
      metadata: patch.expires_at
        ? { is_active: data.isActive, expires_at: patch.expires_at }
        : { is_active: data.isActive },
    });
    return { ok: true, expires_at: patch.expires_at ?? current.expires_at };
  });

export const updateClinicSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clinicId: z.string().uuid(),
      isActive: z.boolean(),
      expiresAt: z.string().datetime().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ is_active: data.isActive, expires_at: data.expiresAt })
      .eq("id", data.clinicId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      clinic_id: data.clinicId,
      action: "clinic.subscription_updated",
      target_type: "clinics",
      target_id: data.clinicId,
      metadata: { is_active: data.isActive, expires_at: data.expiresAt },
    });
    return { ok: true };
  });

export const deleteClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      clinicId: z.string().uuid(),
      confirmSlug: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: clinic, error: fetchErr } = await supabaseAdmin
      .from("clinics")
      .select("id, slug, name")
      .eq("id", data.clinicId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!clinic) throw new Error("Clinic not found");
    if (clinic.slug !== data.confirmSlug) {
      throw new Error("Slug confirmation did not match");
    }

    // Tables that reference clinic_id without an ON DELETE CASCADE.
    await supabaseAdmin.from("clinic_gallery").delete().eq("clinic_id", data.clinicId);
    await supabaseAdmin.from("clinic_testimonials").delete().eq("clinic_id", data.clinicId);
    await supabaseAdmin.from("clinic_treatments").delete().eq("clinic_id", data.clinicId);

    const { error: delErr } = await supabaseAdmin
      .from("clinics")
      .delete()
      .eq("id", data.clinicId);
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      clinic_id: null,
      action: "clinic.deleted",
      target_type: "clinics",
      target_id: data.clinicId,
      metadata: { name: clinic.name, slug: clinic.slug },
    });

    return { ok: true };
  });

const listClinicsSchema = z.object({
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).default(""),
  status: z.enum(["all", "active", "inactive", "expired"]).default("all"),
  sortKey: z.enum(["name", "expires_at", "created_at"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const listClinicsForSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listClinicsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const nowIso = new Date().toISOString();
    let q = supabaseAdmin
      .from("clinics")
      .select(
        "id, name, slug, email, phone, whatsapp, website, address, google_map_url, description, is_active, expires_at, created_at",
        { count: "exact" },
      );

    // Status filter
    if (data.status === "active") {
      q = q.eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    } else if (data.status === "inactive") {
      q = q.eq("is_active", false);
    } else if (data.status === "expired") {
      q = q.not("expires_at", "is", null).lte("expires_at", nowIso);
    }

    // Search across name / phone / email — escape commas which split .or().
    const term = data.search.replace(/[%,()]/g, "");
    if (term) {
      const like = `%${term}%`;
      q = q.or(
        `name.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
      );
    }

    // Sort
    q = q.order(data.sortKey, {
      ascending: data.sortDir === "asc",
      nullsFirst: false,
    });

    // Pagination
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      rows: rows ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });






// ---- System users (super admins with menu-wise RBAC) ----

const permissionsSchema = z.object({
  can_dashboard: z.boolean(),
  can_clinics: z.boolean(),
  can_doctors: z.boolean(),
  can_appointments: z.boolean(),
  can_clinic_settings: z.boolean(),
  can_enquiries: z.boolean(),
  can_customers: z.boolean(),
  can_subscriptions: z.boolean(),
  can_users: z.boolean(),
  can_audit: z.boolean(),
  can_monitoring: z.boolean(),
  can_user_roles: z.boolean(),
});

export type SystemUserPermissions = z.infer<typeof permissionsSchema>;

export type SystemUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_disabled: boolean;
  role_template_id: string | null;
  permissions: SystemUserPermissions;
};

const DEFAULT_PERMS: SystemUserPermissions = {
  can_dashboard: true,
  can_clinics: true,
  can_doctors: true,
  can_appointments: true,
  can_clinic_settings: true,
  can_enquiries: true,
  can_customers: true,
  can_subscriptions: true,
  can_users: true,
  can_audit: true,
  can_monitoring: true,
  can_user_roles: true,
};

const FALSE_PERMS: SystemUserPermissions = {
  can_dashboard: false,
  can_clinics: false,
  can_doctors: false,
  can_appointments: false,
  can_clinic_settings: false,
  can_enquiries: false,
  can_customers: false,
  can_subscriptions: false,
  can_users: false,
  can_audit: false,
  can_monitoring: false,
  can_user_roles: false,
};

function rowToPerms(p: Record<string, unknown>): SystemUserPermissions {
  return {
    can_dashboard: !!p.can_dashboard,
    can_clinics: !!p.can_clinics,
    can_doctors: !!p.can_doctors,
    can_appointments: !!p.can_appointments,
    can_clinic_settings: !!p.can_clinic_settings,
    can_enquiries: !!p.can_enquiries,
    can_customers: !!p.can_customers,
    can_subscriptions: !!p.can_subscriptions,
    can_users: !!p.can_users,
    can_audit: !!p.can_audit,
    can_monitoring: !!p.can_monitoring,
    can_user_roles: !!p.can_user_roles,
  };
}

const listSystemUsersSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })
  .default({ page: 1, pageSize: 25 });

export const listSystemUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSystemUsersSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ users: SystemUser[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);

    const allIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const total = allIds.length;
    if (allIds.length === 0) return { users: [], total: 0 };

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize;
    const ids = allIds.slice(from, to);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
    (profiles ?? []).forEach((p) =>
      profileMap.set(p.id, { full_name: p.full_name, phone: p.phone }),
    );

    const { data: perms } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("*")
      .in("user_id", ids);
    const permMap = new Map<
      string,
      { perms: SystemUserPermissions; is_disabled: boolean; role_template_id: string | null }
    >();
    (perms ?? []).forEach((p) =>
      permMap.set(p.user_id, {
        perms: rowToPerms(p as Record<string, unknown>),
        is_disabled: !!(p as { is_disabled?: boolean }).is_disabled,
        role_template_id: (p as { role_template_id?: string | null }).role_template_id ?? null,
      }),
    );

    const emailMap = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: emails } = await supabaseAdmin.rpc("get_emails_for_ids", {
        _ids: ids,
      });
      ((emails ?? []) as Array<{ id: string; email: string | null }>).forEach((e) =>
        emailMap.set(e.id, e.email ?? null),
      );
    }

    const users: SystemUser[] = ids.map((uid) => {
      const pm = permMap.get(uid);
      const profile = profileMap.get(uid);
      return {
        user_id: uid,
        email: emailMap.get(uid) ?? null,
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        is_disabled: pm?.is_disabled ?? false,
        role_template_id: pm?.role_template_id ?? null,
        permissions: pm?.perms ?? DEFAULT_PERMS,
      };
    });

    return { users, total };
  });

/**
 * Add (create) a new system user. Account is created disabled by default —
 * super admin must explicitly enable it.
 */
export const addSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        password: z.string().min(8).max(72),
        role_template_id: z.string().uuid().nullable(),
        permissions: permissionsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const email = data.email.toLowerCase();

    let userId: string | null = null;
    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone || null },
    });

    if (createRes.error) {
      const msg = createRes.error.message?.toLowerCase() ?? "";
      const exists =
        msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!exists) throw new Error(createRes.error.message);
      const { data: foundId, error: lookupErr } = await supabaseAdmin.rpc(
        "get_user_id_by_email",
        { _email: email },
      );
      if (lookupErr) throw new Error(lookupErr.message);
      userId = (foundId as string | null) ?? null;
      if (!userId) throw new Error("User exists but could not be located");
    } else {
      userId = createRes.data.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to resolve user id");

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, full_name: data.full_name, phone: data.phone || null },
        { onConflict: "id" },
      );

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
      throw new Error(roleErr.message);
    }

    const { error: permErr } = await supabaseAdmin
      .from("super_admin_permissions")
      .upsert(
        {
          user_id: userId,
          ...data.permissions,
          role_template_id: data.role_template_id,
          is_disabled: true, // newly-added users start disabled
        },
        { onConflict: "user_id" },
      );
    if (permErr) throw new Error(permErr.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "system_user.added",
      target_type: "auth.users",
      target_id: userId,
    });

    return { user_id: userId };
  });

export const updateSystemUserPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role_template_id: z.string().uuid().nullable(),
        permissions: permissionsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    const { error } = await supabaseAdmin
      .from("super_admin_permissions")
      .upsert(
        {
          user_id: data.user_id,
          ...data.permissions,
          role_template_id: data.role_template_id,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "system_user.permissions_updated",
      target_type: "auth.users",
      target_id: data.user_id,
    });

    return { ok: true };
  });

export const setSystemUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId && data.disabled) {
      throw new Error("You cannot disable your own account");
    }

    const { error } = await supabaseAdmin
      .from("super_admin_permissions")
      .upsert(
        { user_id: data.user_id, is_disabled: data.disabled },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: data.disabled ? "system_user.disabled" : "system_user.enabled",
      target_type: "auth.users",
      target_id: data.user_id,
    });

    return { ok: true };
  });

/**
 * Admin-set password reset for another system user. Mirrors the direct-set
 * pattern used during account creation. Never logs the password.
 */
export const resetSystemUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Use your profile page to change your own password");
    }

    // Caller must hold `can_users` — not every super admin can mint
    // credentials for peers.
    const { data: callerPerm } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("can_users")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!callerPerm?.can_users) {
      throw new Error("Not authorized to manage system users");
    }

    // Target MUST be another system user (in super_admin_permissions).
    // This endpoint is for super-admin peers only — it must not be used
    // as a side channel to reset clinic-manager passwords. The
    // setClinicManagerPassword endpoint exists for that path and writes
    // its own audit row.
    const { data: targetPerm } = await supabaseAdmin
      .from("super_admin_permissions")
      .select("user_id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!targetPerm) {
      throw new Error("Target is not a system user");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.user_id,
      { password: data.password },
    );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "system_user.password_reset",
      target_type: "auth.users",
      target_id: data.user_id,
    });

    return { ok: true };
  });

// ---- Self profile ----

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const uid = context.userId;
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: uid, full_name: data.full_name, phone: data.phone || null },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin.auth.admin.updateUserById(uid, {
      user_metadata: { full_name: data.full_name, phone: data.phone || null },
    });

    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    const uid = context.userId;
    const [{ data: profile }, { data: u }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, phone")
        .eq("id", uid)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(uid),
    ]);
    return {
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: u?.user?.email ?? null,
    };
  });

// ---- Role templates ----

export type RoleTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: SystemUserPermissions;
  created_at: string;
};

function normalizePerms(input: Record<string, unknown> | null | undefined): SystemUserPermissions {
  if (!input) return { ...FALSE_PERMS };
  return rowToPerms(input);
}

const listRoleTemplatesSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })
  .default({ page: 1, pageSize: 25 });

export const listRoleTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listRoleTemplatesSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ roles: RoleTemplate[]; total: number }> => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await supabaseAdmin
      .from("role_templates")
      .select("*", { count: "exact" })
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return {
      roles: (rows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        is_system: !!r.is_system,
        permissions: normalizePerms(r.permissions as Record<string, unknown>),
        created_at: r.created_at,
      })),
      total: count ?? 0,
    };
  });

export const saveRoleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        name: z.string().trim().min(2).max(60),
        description: z.string().trim().max(500).optional().or(z.literal("")),
        permissions: permissionsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    if (data.id) {
      const { data: existing } = await supabaseAdmin
        .from("role_templates")
        .select("is_system")
        .eq("id", data.id)
        .maybeSingle();
      // Built-in roles: super admin can change permissions + description,
      // but the name stays locked so existing references remain stable.
      const updatePayload = existing?.is_system
        ? {
            description: data.description || null,
            permissions: data.permissions,
          }
        : {
            name: data.name,
            description: data.description || null,
            permissions: data.permissions,
          };
      const { error } = await supabaseAdmin
        .from("role_templates")
        .update(updatePayload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("role_templates")
      .insert({
        name: data.name,
        description: data.description || null,
        permissions: data.permissions,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRoleTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("role_templates")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.is_system) throw new Error("Built-in roles cannot be deleted");
    // Detach any users currently linked to this role
    await supabaseAdmin
      .from("super_admin_permissions")
      .update({ role_template_id: null })
      .eq("role_template_id", data.id);
    const { error } = await supabaseAdmin.from("role_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SMS Provider settings ----------

const smsProviderEnum = z.enum(["dev", "twilio", "msg91", "gupshup", "on_screen"]);
const smsSettingsSchema = z.object({
  provider: smsProviderEnum,
  enabled: z.boolean(),
  twilio: z
    .object({
      accountSid: z.string().trim().max(120).optional().or(z.literal("")),
      authToken: z.string().trim().max(200).optional().or(z.literal("")),
      fromNumber: z.string().trim().max(40).optional().or(z.literal("")),
    })
    .optional(),
  msg91: z
    .object({
      authKey: z.string().trim().max(200).optional().or(z.literal("")),
      senderId: z.string().trim().max(40).optional().or(z.literal("")),
      templateId: z.string().trim().max(80).optional().or(z.literal("")),
    })
    .optional(),
  gupshup: z
    .object({
      apiKey: z.string().trim().max(200).optional().or(z.literal("")),
      source: z.string().trim().max(80).optional().or(z.literal("")),
      appName: z.string().trim().max(80).optional().or(z.literal("")),
    })
    .optional(),
});

function maskCreds(s: Record<string, string | undefined> | undefined) {
  if (!s) return s;
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(s)) {
    if (!v) { out[k] = ""; continue; }
    // Mask anything that looks like a secret; keep short, public-ish fields visible.
    if (/token|key|secret|password/i.test(k)) {
      out[k] = v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const getSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("sms, updated_at")
      .limit(1)
      .maybeSingle();
    const raw = (data?.sms ?? {}) as z.infer<typeof smsSettingsSchema>;
    const settings = {
      provider: (raw.provider as "dev" | "twilio" | "msg91" | "gupshup" | "on_screen") || "on_screen",
      enabled: raw.enabled ?? true,
      twilio: maskCreds(raw.twilio as Record<string, string | undefined> | undefined),
      msg91: maskCreds(raw.msg91 as Record<string, string | undefined> | undefined),
      gupshup: maskCreds(raw.gupshup as Record<string, string | undefined> | undefined),
    };
    return { settings, updatedAt: data?.updated_at ?? null };
  });

export const updateSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => smsSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);

    // Merge with existing so the UI can omit unchanged secret fields (we mask
    // them on read). Empty string from the client means "leave as-is".
    const { data: existingRow } = await supabaseAdmin
      .from("platform_settings")
      .select("id, sms")
      .limit(1)
      .maybeSingle();
    const existing = (existingRow?.sms ?? {}) as Record<string, Record<string, string> | string | boolean>;

    function merge(prev: Record<string, string> | undefined, next: Record<string, string | undefined> | undefined) {
      const out: Record<string, string> = { ...(prev ?? {}) };
      if (!next) return out;
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === "") continue;
        out[k] = v;
      }
      return out;
    }

    const nextSms = {
      provider: data.provider,
      enabled: data.enabled,
      twilio: merge(existing.twilio as Record<string, string> | undefined, data.twilio),
      msg91: merge(existing.msg91 as Record<string, string> | undefined, data.msg91),
      gupshup: merge(existing.gupshup as Record<string, string> | undefined, data.gupshup),
    };

    if (existingRow?.id) {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .update({ sms: nextSms, updated_by: context.userId, updated_at: new Date().toISOString() })
        .eq("id", existingRow.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .insert({ sms: nextSms, updated_by: context.userId });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "sms_settings.update",
      target_type: "platform_settings",
      metadata: { provider: data.provider, enabled: data.enabled },
    });

    return { ok: true };
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().trim().min(6).max(20).regex(/^[+\d\s()-]+$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertSuperAdmin(context.userId);
    const { sendOtpSms } = await import("./sms/provider.server");
    const code = (100000 + Math.floor(Math.random() * 900000)).toString();
    const result = await sendOtpSms(data.phone, code);
    await supabaseAdmin.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "sms_settings.test",
      target_type: "platform_settings",
      metadata: { provider: result.provider, ok: result.ok },
    });
    if (!result.ok) return { ok: false as const, error: result.error, provider: result.provider };
    return {
      ok: true as const,
      provider: result.provider,
      // Echo the code only for the dev provider so the operator can verify
      // the pipeline end-to-end without a real SMS account.
      devCode: result.provider === "dev" ? code : undefined,
    };
  });
