
CREATE TABLE public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('cron','deploy','manual')),
  commit_sha text,
  total int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  warned int NOT NULL DEFAULT 0,
  errored int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed'))
);

CREATE INDEX security_scan_runs_started_at_idx ON public.security_scan_runs (started_at DESC);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;

ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins read scan runs"
  ON public.security_scan_runs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.super_admin_permissions sap
      WHERE sap.user_id = auth.uid() AND sap.is_disabled = true
    )
  );

CREATE TABLE public.security_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.security_scan_runs(id) ON DELETE CASCADE,
  check_id text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  status text NOT NULL CHECK (status IN ('pass','fail','warn','error')),
  title text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_scan_findings_run_id_idx ON public.security_scan_findings (run_id);
CREATE INDEX security_scan_findings_severity_idx ON public.security_scan_findings (severity);

GRANT SELECT ON public.security_scan_findings TO authenticated;
GRANT ALL ON public.security_scan_findings TO service_role;

ALTER TABLE public.security_scan_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins read scan findings"
  ON public.security_scan_findings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.super_admin_permissions sap
      WHERE sap.user_id = auth.uid() AND sap.is_disabled = true
    )
  );

-- Daily retention: drop scan runs older than 90 days (findings cascade)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-security-scan-runs') THEN
    PERFORM cron.unschedule('cleanup-security-scan-runs');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-security-scan-runs',
  '23 3 * * *',
  $$DELETE FROM public.security_scan_runs WHERE started_at < now() - INTERVAL '90 days';$$
);
