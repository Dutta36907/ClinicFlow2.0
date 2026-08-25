DROP FUNCTION public.get_user_auth_context(uuid);

CREATE FUNCTION public.get_user_auth_context(_uid uuid)
RETURNS TABLE(is_super boolean, is_disabled boolean, clinic_ids uuid[], clinic_user_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _uid AND role = 'super_admin'
    ) AS is_super,
    COALESCE(
      (SELECT sap.is_disabled FROM public.super_admin_permissions sap WHERE sap.user_id = _uid),
      false
    ) AS is_disabled,
    COALESCE(
      ARRAY(
        SELECT ur.clinic_id FROM public.user_roles ur
        WHERE ur.user_id = _uid
          AND ur.role = 'clinic_manager'
          AND ur.clinic_id IS NOT NULL
      ),
      '{}'::uuid[]
    ) AS clinic_ids,
    COALESCE(
      ARRAY(
        SELECT ur.clinic_id FROM public.user_roles ur
        WHERE ur.user_id = _uid
          AND ur.role = 'clinic_user'
          AND ur.clinic_id IS NOT NULL
      ),
      '{}'::uuid[]
    ) AS clinic_user_ids;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_auth_context(uuid) TO authenticated, service_role;
