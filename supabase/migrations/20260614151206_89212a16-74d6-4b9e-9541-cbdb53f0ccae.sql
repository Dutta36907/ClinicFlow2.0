
-- Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_appt_patient_phone ON public.appointments(patient_phone);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_status ON public.appointments(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_clinic_date  ON public.audit_log(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON public.audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinics_active     ON public.clinics(is_active);
CREATE INDEX IF NOT EXISTS idx_clinics_expires_active
  ON public.clinics(expires_at) WHERE is_active = true;

-- Helper for RLS coverage smoke test (SECURITY DEFINER reads pg_tables)
CREATE OR REPLACE FUNCTION public.get_rls_status()
RETURNS TABLE(tablename text, rowsecurity boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT tablename::text, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;

REVOKE ALL ON FUNCTION public.get_rls_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rls_status() TO authenticated, service_role;
