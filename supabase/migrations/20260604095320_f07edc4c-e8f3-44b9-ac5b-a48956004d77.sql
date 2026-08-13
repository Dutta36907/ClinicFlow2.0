
-- 1) Idempotently seed and protect the two system role templates.
INSERT INTO public.role_templates (name, description, permissions, is_system)
VALUES
  ('Super Admin',
   'Full platform access — all menus and actions.',
   jsonb_build_object(
     'can_dashboard', true, 'can_clinics', true, 'can_doctors', true,
     'can_appointments', true, 'can_clinic_settings', true, 'can_enquiries', true,
     'can_customers', true, 'can_subscriptions', true, 'can_users', true,
     'can_user_roles', true, 'can_audit', true, 'can_monitoring', true
   ),
   true),
  ('Admin',
   'Day-to-day admin access — manage clinics, doctors, appointments and customers.',
   jsonb_build_object(
     'can_dashboard', true, 'can_clinics', true, 'can_doctors', true,
     'can_appointments', true, 'can_clinic_settings', true, 'can_enquiries', true,
     'can_customers', true, 'can_subscriptions', true, 'can_users', false,
     'can_user_roles', false, 'can_audit', false, 'can_monitoring', false
   ),
   true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      permissions = EXCLUDED.permissions,
      is_system   = true,
      updated_at  = now();

-- 2) Protect system templates from deletion or critical mutation.
CREATE OR REPLACE FUNCTION public.protect_system_role_templates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'System role templates cannot be deleted';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_system AND (NEW.name <> OLD.name OR NEW.is_system = false) THEN
      RAISE EXCEPTION 'Cannot rename or unflag system role templates';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_role_templates ON public.role_templates;
CREATE TRIGGER trg_protect_system_role_templates
  BEFORE UPDATE OR DELETE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_role_templates();
