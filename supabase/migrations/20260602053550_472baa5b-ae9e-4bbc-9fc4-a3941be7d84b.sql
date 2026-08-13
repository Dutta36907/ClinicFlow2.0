
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) TO service_role;
