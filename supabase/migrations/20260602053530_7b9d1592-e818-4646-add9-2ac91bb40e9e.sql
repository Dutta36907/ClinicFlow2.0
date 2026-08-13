
-- 1. role_templates
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_templates TO authenticated;
GRANT ALL ON public.role_templates TO service_role;

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_templates super admin all"
  ON public.role_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER touch_role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. extend super_admin_permissions
ALTER TABLE public.super_admin_permissions
  ADD COLUMN IF NOT EXISTS can_user_roles boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS role_template_id uuid;

-- Existing super admins retain full access
UPDATE public.super_admin_permissions SET can_user_roles = true WHERE can_users = true;

-- 3. Seed default role templates
INSERT INTO public.role_templates (name, description, is_system, permissions) VALUES
  ('Super Admin', 'Full platform access', true, '{
    "can_dashboard": true, "can_clinics": true, "can_doctors": true,
    "can_appointments": true, "can_clinic_settings": true, "can_enquiries": true,
    "can_customers": true, "can_users": true, "can_audit": true,
    "can_monitoring": true, "can_user_roles": true
  }'::jsonb),
  ('Admin', 'Manage clinics, doctors, appointments, enquiries, and customers', true, '{
    "can_dashboard": true, "can_clinics": true, "can_doctors": true,
    "can_appointments": true, "can_clinic_settings": true, "can_enquiries": true,
    "can_customers": true, "can_users": false, "can_audit": true,
    "can_monitoring": false, "can_user_roles": false
  }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 4. Bootstrap function: promotes a user to super_admin iff no super_admin exists.
CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    can_clinic_settings, can_enquiries, can_customers, can_users,
    can_audit, can_monitoring, can_user_roles, is_disabled
  ) VALUES (
    _user_id, true, true, true, true, true, true, true, true, true, true, true, false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    can_dashboard = true, can_clinics = true, can_doctors = true,
    can_appointments = true, can_clinic_settings = true, can_enquiries = true,
    can_customers = true, can_users = true, can_audit = true,
    can_monitoring = true, can_user_roles = true, is_disabled = false;

  RETURN jsonb_build_object('bootstrapped', true, 'user_id', _user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) TO authenticated, service_role;
