INSERT INTO public.role_templates (name, description, permissions, is_system)
VALUES
  ('Super Admin', 'Full access to every menu and setting.', '{
    "can_dashboard": true, "can_clinics": true, "can_doctors": true,
    "can_appointments": true, "can_clinic_settings": true, "can_enquiries": true,
    "can_customers": true, "can_subscriptions": true, "can_users": true,
    "can_user_roles": true, "can_audit": true, "can_monitoring": true
  }'::jsonb, true),
  ('Admin', 'Day-to-day operations: clinics, doctors, appointments, enquiries, customers, and subscriptions. No system-level access.', '{
    "can_dashboard": true, "can_clinics": true, "can_doctors": true,
    "can_appointments": true, "can_clinic_settings": true, "can_enquiries": true,
    "can_customers": true, "can_subscriptions": true, "can_users": false,
    "can_user_roles": false, "can_audit": false, "can_monitoring": false
  }'::jsonb, true)
ON CONFLICT DO NOTHING;