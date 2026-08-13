REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(uuid) TO service_role;