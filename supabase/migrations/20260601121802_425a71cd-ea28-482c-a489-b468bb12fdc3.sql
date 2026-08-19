
-- 1) Lock down SECURITY DEFINER functions: revoke EXECUTE from public/anon.
-- These are role-check helpers used inside RLS policies; authenticated still
-- needs EXECUTE so policies evaluate correctly. Anon and PUBLIC do not.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_clinic_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_clinic_member(uuid, uuid) FROM PUBLIC, anon;

-- Server/trigger-only functions: no client role should call these directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- 2) Pin search_path on remaining helper functions to prevent search_path hijacking.
ALTER FUNCTION public.appt_time_range(timestamp with time zone, integer)
  SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- 3) Add explicit deny-all policies for server-only tables so RLS posture is
--    clear (silences "RLS enabled, no policy"). Service role bypasses RLS and
--    keeps full access for server functions.
CREATE POLICY "patient_otp no client access"
  ON public.patient_otp FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "rate_limit_buckets no client access"
  ON public.rate_limit_buckets FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 4) Realtime authorization: restrict channel subscriptions on appointments.
--    Topic convention: 'clinic:<clinic_uuid>'. Only clinic members may
--    subscribe / receive broadcasts. realtime.messages RLS is the authoritative
--    check for live channel access; without it any signed-in user could
--    subscribe to any topic and receive patient PHI. RLS is already enabled
--    on realtime.messages by default on this platform (owned by
--    supabase_realtime_admin) — the postgres role can't ALTER TABLE it, but
--    CREATE/DROP POLICY on it works without ownership.
DROP POLICY IF EXISTS "clinic members can read realtime" ON realtime.messages;
CREATE POLICY "clinic members can read realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    public.is_clinic_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
    AND split_part(realtime.topic(), ':', 1) = 'clinic'
  );

DROP POLICY IF EXISTS "clinic members can broadcast realtime" ON realtime.messages;
CREATE POLICY "clinic members can broadcast realtime"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_clinic_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
    AND split_part(realtime.topic(), ':', 1) = 'clinic'
  );
