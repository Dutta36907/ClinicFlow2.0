
DROP POLICY IF EXISTS "gallery public read" ON public.clinic_gallery;
DROP POLICY IF EXISTS "testimonials public read" ON public.clinic_testimonials;
DROP POLICY IF EXISTS "treatments public read" ON public.clinic_treatments;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        _role <> 'super_admin'::app_role
        OR NOT EXISTS (
          SELECT 1 FROM public.super_admin_permissions sap
          WHERE sap.user_id = _user_id AND sap.is_disabled = true
        )
      )
  );
$$;
