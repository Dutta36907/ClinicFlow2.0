-- Replace the email-based bootstrap function with an id-based, self-sealing variant.
-- The new function only succeeds when zero super_admins exist, atomically (single statement),
-- so concurrent callers cannot both win.

DROP FUNCTION IF EXISTS public.bootstrap_first_super_admin(text);

CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted int;
BEGIN
  -- Atomic self-seal: insert only if no super_admin exists yet.
  INSERT INTO public.user_roles (user_id, role)
  SELECT _user_id, 'super_admin'::app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'super_admin'
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted = 0 THEN
    RETURN jsonb_build_object('bootstrapped', false, 'reason', 'super_admin_exists');
  END IF;

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
$$;