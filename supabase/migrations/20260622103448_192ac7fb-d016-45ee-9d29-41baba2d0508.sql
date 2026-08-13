-- Restrict anon SELECT to safe columns only on clinics and doctor_slot_overrides.
-- RLS policies still apply; column-level GRANTs prevent anon from reading
-- sensitive columns (notification prefs, billing, override reasons).

REVOKE SELECT ON public.clinics FROM anon;
GRANT SELECT (
  id, slug, name, phone, email, whatsapp, website, google_map_url,
  description, tagline, address, logo_url, cover_image_url,
  performance_stats, timezone, working_hours,
  appointment_duration_minutes, is_active, expires_at
) ON public.clinics TO anon;

REVOKE SELECT ON public.doctor_slot_overrides FROM anon;
GRANT SELECT (
  id, doctor_id, date, start_time, end_time, is_blocked
) ON public.doctor_slot_overrides TO anon;