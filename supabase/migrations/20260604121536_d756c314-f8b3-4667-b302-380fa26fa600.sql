-- 1. clinics: trial_ends_at + plan
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan text;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_plan_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_plan_check
  CHECK (plan IS NULL OR plan = ANY (ARRAY['trial','starter','pro','enterprise']));

-- 2. enquiries: assigned_to
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. system_alerts table
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level = ANY (ARRAY['info','warning','critical'])),
  title text NOT NULL,
  body text,
  source text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_alerts TO authenticated;
GRANT ALL ON public.system_alerts TO service_role;

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_alerts super admin read" ON public.system_alerts;
CREATE POLICY "system_alerts super admin read"
  ON public.system_alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "system_alerts super admin write" ON public.system_alerts;
CREATE POLICY "system_alerts super admin write"
  ON public.system_alerts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved
  ON public.system_alerts (created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_alerts_level_created
  ON public.system_alerts (level, created_at DESC);

-- 4. Performance indexes for dashboard
CREATE INDEX IF NOT EXISTS idx_appointments_created_at
  ON public.appointments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_created
  ON public.appointments (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_to
  ON public.enquiries (assigned_to);
CREATE INDEX IF NOT EXISTS idx_clinics_expires_at
  ON public.clinics (expires_at);
CREATE INDEX IF NOT EXISTS idx_clinics_trial_ends_at
  ON public.clinics (trial_ends_at);

-- 5. Seed two example alerts (only when table is empty)
INSERT INTO public.system_alerts (level, title, body, source)
SELECT 'info', 'Dashboard upgraded',
       'New super-admin dashboard cards and system monitor metrics are now live.',
       'system'
WHERE NOT EXISTS (SELECT 1 FROM public.system_alerts);

INSERT INTO public.system_alerts (level, title, body, source)
SELECT 'info', 'Welcome to System Alerts',
       'Critical and warning alerts emitted by server functions will appear here.',
       'system'
WHERE (SELECT count(*) FROM public.system_alerts) < 2;

-- ----------------------------------------------------------------------------
-- Rollback (manual; run as a follow-up migration if needed):
--   ALTER TABLE public.clinics DROP COLUMN trial_ends_at;
--   ALTER TABLE public.clinics DROP COLUMN plan;
--   ALTER TABLE public.enquiries DROP COLUMN assigned_to;
--   DROP TABLE public.system_alerts;
--   DROP INDEX IF EXISTS idx_appointments_created_at;
--   DROP INDEX IF EXISTS idx_appointments_clinic_created;
--   DROP INDEX IF EXISTS idx_enquiries_assigned_to;
--   DROP INDEX IF EXISTS idx_clinics_expires_at;
--   DROP INDEX IF EXISTS idx_clinics_trial_ends_at;