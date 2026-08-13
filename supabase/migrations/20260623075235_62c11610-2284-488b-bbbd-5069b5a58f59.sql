-- Revoke broad anon SELECT and re-grant only safe columns (exclude `reason`)
REVOKE SELECT ON public.doctor_slot_overrides FROM anon;
GRANT SELECT (id, doctor_id, date, start_time, end_time, is_blocked, created_at)
  ON public.doctor_slot_overrides TO anon;