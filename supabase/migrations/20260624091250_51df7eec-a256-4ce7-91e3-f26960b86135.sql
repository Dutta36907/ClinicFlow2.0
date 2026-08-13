CREATE OR REPLACE FUNCTION public.is_clinic_member(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.clinic_id = _clinic_id
        OR (
          ur.role = 'super_admin'
          AND NOT EXISTS (
            SELECT 1 FROM public.super_admin_permissions sap
            WHERE sap.user_id = _user_id AND sap.is_disabled = true
          )
        )
      )
  );
$$;