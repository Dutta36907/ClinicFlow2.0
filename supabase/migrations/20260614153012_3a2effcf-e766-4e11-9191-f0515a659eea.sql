ALTER TABLE public.patient_otp
  ADD COLUMN IF NOT EXISTS session_id_hash text,
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'sms';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_otp_method_check'
  ) THEN
    ALTER TABLE public.patient_otp
      ADD CONSTRAINT patient_otp_method_check
      CHECK (method IN ('sms','on_screen','totp'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_otp_session
  ON public.patient_otp(session_id_hash, consumed_at);

-- Recreate the cleanup job to handle on_screen rows on a tighter schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'otp-cleanup') THEN
    PERFORM cron.unschedule('otp-cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'otp-cleanup',
  '*/5 * * * *',
  $$
  DELETE FROM public.patient_otp
  WHERE (method = 'on_screen' AND created_at < NOW() - INTERVAL '5 minutes')
     OR (method <> 'on_screen' AND expires_at < NOW() - INTERVAL '1 hour')
  $$
);