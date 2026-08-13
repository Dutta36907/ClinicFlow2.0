
-- 1. notification_log table
CREATE TABLE IF NOT EXISTS public.notification_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  recipient_phone text,
  recipient_email text,
  channel         text NOT NULL CHECK (channel IN ('sms','whatsapp','email','all')),
  event_type      text NOT NULL,
  status          text NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent','failed','skipped')),
  skip_reason     text,
  provider        text,
  provider_msg_id text,
  error_message   text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_log_super_admin" ON public.notification_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "notif_log_manager_read" ON public.notification_log
  FOR SELECT TO authenticated
  USING (
    clinic_id IS NOT NULL
    AND public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_notif_log_clinic ON public.notification_log(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_event ON public.notification_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_status ON public.notification_log(status, created_at DESC);

-- 2. Per-event clinic notification toggles
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS notify_patient_booking_sms       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_patient_booking_whatsapp  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_patient_booking_email     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_patient_reschedule_sms    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_patient_reschedule_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_patient_reschedule_email  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_clinic_new_booking_sms    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_clinic_new_booking_email  boolean NOT NULL DEFAULT true;

-- 3. Seed platform_settings notification blocks (single-row table)
INSERT INTO public.platform_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

UPDATE public.platform_settings
SET
  notifications = COALESCE(notifications, '{}'::jsonb) ||
    jsonb_build_object(
      'master_enabled', COALESCE((notifications->>'master_enabled')::boolean, true),
      'events', COALESCE(notifications->'events', jsonb_build_object(
        'appointment_booked',      jsonb_build_object('is_enabled', true),
        'appointment_rescheduled', jsonb_build_object('is_enabled', true),
        'clinic_new_booking',      jsonb_build_object('is_enabled', true),
        'new_clinic_welcome',      jsonb_build_object('is_enabled', true),
        'subscription_expiry',     jsonb_build_object('is_enabled', true)
      ))
    ),
  sms = COALESCE(sms, '{}'::jsonb) ||
    jsonb_build_object(
      'is_enabled', COALESCE((sms->>'is_enabled')::boolean, sms->>'enabled' IS NULL OR (sms->>'enabled')::boolean),
      'msg91_template_ids', COALESCE(sms->'msg91_template_ids', jsonb_build_object(
        'otp', '', 'appointment_booked', '', 'appointment_rescheduled', '',
        'clinic_new_booking', '', 'subscription_expiry', ''
      ))
    ),
  whatsapp = COALESCE(whatsapp, '{}'::jsonb) ||
    jsonb_build_object(
      'is_enabled',        COALESCE((whatsapp->>'is_enabled')::boolean, false),
      'provider',          COALESCE(whatsapp->>'provider', 'interakt'),
      'interakt_api_key',  COALESCE(whatsapp->>'interakt_api_key', ''),
      'interakt_base_url', COALESCE(whatsapp->>'interakt_base_url', 'https://api.interakt.ai/v1/public/message/'),
      'template_ids',      COALESCE(whatsapp->'template_ids', jsonb_build_object(
        'appointment_booked', '', 'appointment_rescheduled', '', 'subscription_expiry', ''
      ))
    ),
  email = COALESCE(email, '{}'::jsonb) ||
    jsonb_build_object(
      'is_enabled',     COALESCE((email->>'is_enabled')::boolean, true),
      'provider',       COALESCE(email->>'provider', 'resend'),
      'resend_api_key', COALESCE(email->>'resend_api_key', ''),
      'from_address',   COALESCE(email->>'from_address', ''),
      'from_name',      COALESCE(email->>'from_name', 'ClinicFlow')
    );

-- 4. Daily cleanup job for notification_log (>90 days)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('notif-log-cleanup')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-log-cleanup');
    PERFORM cron.schedule(
      'notif-log-cleanup',
      '0 2 * * *',
      $cron$ DELETE FROM public.notification_log WHERE created_at < NOW() - INTERVAL '90 days' $cron$
    );
  END IF;
END $$;
