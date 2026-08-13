ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS consent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'otp-cleanup',
  '0 * * * *',
  $$ DELETE FROM public.patient_otp WHERE expires_at < NOW() - INTERVAL '1 hour' $$
);