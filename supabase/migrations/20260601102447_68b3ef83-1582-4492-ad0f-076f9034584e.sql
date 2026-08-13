
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE INDEX IF NOT EXISTS idx_appts_doctor_sched
  ON public.appointments (doctor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appts_clinic_sched
  ON public.appointments (clinic_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_active
  ON public.doctors (clinic_id, is_active);
CREATE INDEX IF NOT EXISTS idx_doctor_sched_lookup
  ON public.doctor_schedules (doctor_id, weekday, is_active);
CREATE INDEX IF NOT EXISTS idx_doctor_overrides_lookup
  ON public.doctor_slot_overrides (doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic
  ON public.user_roles (clinic_id, role);
CREATE INDEX IF NOT EXISTS idx_patient_otp_phone_lookup
  ON public.patient_otp (phone, consumed_at, created_at DESC);

-- Immutable wrapper so the expression is accepted in EXCLUDE / index expressions.
-- Safe: tstzrange + integer-minute arithmetic does not depend on session state.
CREATE OR REPLACE FUNCTION public.appt_time_range(_scheduled timestamptz, _mins integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT tstzrange(_scheduled, _scheduled + (_mins * INTERVAL '1 minute'))
$$;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    public.appt_time_range(scheduled_at, duration_minutes) WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'rescheduled'));

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key          text PRIMARY KEY,
  tokens       integer NOT NULL,
  refilled_at  timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _key text,
  _capacity integer,
  _refill_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now        timestamptz := now();
  _row        public.rate_limit_buckets%ROWTYPE;
  _refill     integer;
  _new_tokens integer;
BEGIN
  INSERT INTO public.rate_limit_buckets (key, tokens, refilled_at)
  VALUES (_key, _capacity, _now)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO _row FROM public.rate_limit_buckets WHERE key = _key FOR UPDATE;

  _refill := floor(EXTRACT(EPOCH FROM (_now - _row.refilled_at)) / _refill_seconds)::int * _capacity;
  _new_tokens := LEAST(_capacity, _row.tokens + GREATEST(_refill, 0));

  IF _new_tokens <= 0 THEN
    UPDATE public.rate_limit_buckets
      SET tokens = _new_tokens,
          refilled_at = CASE WHEN _refill > 0 THEN _now ELSE _row.refilled_at END
      WHERE key = _key;
    RETURN false;
  END IF;

  UPDATE public.rate_limit_buckets
    SET tokens = _new_tokens - 1,
        refilled_at = CASE WHEN _refill > 0 THEN _now ELSE _row.refilled_at END
    WHERE key = _key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

DO $$
DECLARE
  _job_id bigint;
BEGIN
  SELECT jobid INTO _job_id FROM cron.job WHERE jobname = 'cleanup-expired-patient-otp';
  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;
  PERFORM cron.schedule(
    'cleanup-expired-patient-otp',
    '17 * * * *',
    $cron$DELETE FROM public.patient_otp WHERE expires_at < now() - interval '1 day'$cron$
  );
END $$;
