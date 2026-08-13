ALTER TABLE public.super_admin_permissions
  ADD COLUMN IF NOT EXISTS can_subscriptions boolean NOT NULL DEFAULT false;

UPDATE public.super_admin_permissions
  SET can_subscriptions = true
  WHERE can_customers = true AND can_clinics = true AND can_users = true;

CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing_count int;
  _user_id uuid;
BEGIN
  SELECT count(*) INTO _existing_count
  FROM public.user_roles WHERE role = 'super_admin';

  IF _existing_count > 0 THEN
    RETURN jsonb_build_object('bootstrapped', false, 'reason', 'super_admin_exists');
  END IF;

  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('bootstrapped', false, 'reason', 'user_not_found');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'super_admin')
    ON CONFLICT DO NOTHING;

  INSERT INTO public.super_admin_permissions (
    user_id, can_dashboard, can_clinics, can_doctors, can_appointments,
    can_clinic_settings, can_enquiries, can_customers, can_subscriptions,
    can_users, can_audit, can_monitoring, can_user_roles, is_disabled
  ) VALUES (
    _user_id, true, true, true, true, true, true, true, true, true, true, true, true, false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    can_dashboard = true, can_clinics = true, can_doctors = true,
    can_appointments = true, can_clinic_settings = true, can_enquiries = true,
    can_customers = true, can_subscriptions = true, can_users = true,
    can_audit = true, can_monitoring = true, can_user_roles = true, is_disabled = false;

  RETURN jsonb_build_object('bootstrapped', true, 'user_id', _user_id);
END;
$function$;