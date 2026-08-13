
-- Tracks every transactional email attempt. The idempotency_key column is
-- the dedup mechanism: the dispatcher computes a stable key per (event,
-- entity, recipient, bucket) and aborts before calling Resend if a row with
-- status='sent' already exists. status='pending' rows track in-flight sends
-- so concurrent dispatches collapse to one provider call.

CREATE TABLE public.email_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX email_send_log_created_idx
  ON public.email_send_log (created_at DESC);
CREATE INDEX email_send_log_clinic_idx
  ON public.email_send_log (clinic_id, created_at DESC);
CREATE INDEX email_send_log_event_idx
  ON public.email_send_log (event_type, created_at DESC);

-- Authenticated users (super admins) can read for the dashboard; nobody
-- writes through the Data API — all writes go through the service-role
-- dispatcher inside server functions.
GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_send_log super admin read"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
