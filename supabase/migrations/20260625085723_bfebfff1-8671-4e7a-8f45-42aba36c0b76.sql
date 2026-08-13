-- Restrict direct API execution of SECURITY DEFINER helpers.
-- RLS policies still work: Postgres evaluates RLS as the current role,
-- so functions referenced inside policies need EXECUTE for `authenticated`.
-- service_role bypasses these grants entirely.

-- Helpers used inside RLS policies (must remain callable by authenticated)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_clinic_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_clinic_member(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_clinic_role(uuid, uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_clinic_role(uuid, uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_auth_context(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_auth_context(uuid) TO authenticated, service_role;

-- One-time bootstrap: called by the signed-in user creating the first super admin
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid, text) TO authenticated, service_role;

-- Backend-only helpers (called from server functions using service_role)
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_emails_for_ids(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_emails_for_ids(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_rls_status() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_rls_status() TO service_role;
