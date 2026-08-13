CREATE OR REPLACE FUNCTION public.has_clinic_role(_user_id uuid, _clinic_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.clinic_id = _clinic_id
      AND ur.role = _role
      AND (
        _role <> 'super_admin'::app_role
        OR NOT EXISTS (
          SELECT 1 FROM public.super_admin_permissions sap
          WHERE sap.user_id = _user_id AND sap.is_disabled = true
        )
      )
  );
$function$;