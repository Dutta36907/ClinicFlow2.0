
-- 1. platform_settings: single-row global config
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  general jsonb NOT NULL DEFAULT '{}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  email jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp jsonb NOT NULL DEFAULT '{}'::jsonb,
  sms jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings super admin read"
ON public.platform_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "platform_settings super admin insert"
ON public.platform_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "platform_settings super admin update"
ON public.platform_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER platform_settings_touch
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the single row
INSERT INTO public.platform_settings DEFAULT VALUES;


-- 2. super_admin_permissions: per-user menu access
CREATE TABLE public.super_admin_permissions (
  user_id uuid PRIMARY KEY,
  can_dashboard boolean NOT NULL DEFAULT true,
  can_clinics boolean NOT NULL DEFAULT false,
  can_doctors boolean NOT NULL DEFAULT false,
  can_appointments boolean NOT NULL DEFAULT false,
  can_clinic_settings boolean NOT NULL DEFAULT false,
  can_enquiries boolean NOT NULL DEFAULT false,
  can_customers boolean NOT NULL DEFAULT false,
  can_users boolean NOT NULL DEFAULT false,
  can_audit boolean NOT NULL DEFAULT false,
  can_monitoring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_permissions TO authenticated;
GRANT ALL ON public.super_admin_permissions TO service_role;

ALTER TABLE public.super_admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_perms self read"
ON public.super_admin_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "sa_perms super admin all"
ON public.super_admin_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER super_admin_permissions_touch
BEFORE UPDATE ON public.super_admin_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bootstrap: every existing super admin gets full access
INSERT INTO public.super_admin_permissions (
  user_id, can_dashboard, can_clinics, can_doctors, can_appointments,
  can_clinic_settings, can_enquiries, can_customers, can_users,
  can_audit, can_monitoring
)
SELECT DISTINCT user_id, true, true, true, true, true, true, true, true, true, true
FROM public.user_roles
WHERE role = 'super_admin'::app_role
ON CONFLICT (user_id) DO NOTHING;
