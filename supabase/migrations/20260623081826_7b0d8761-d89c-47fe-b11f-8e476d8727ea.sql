DROP POLICY IF EXISTS "clinics public read active" ON public.clinics;
DROP POLICY IF EXISTS "doctors public read active" ON public.doctors;
DROP POLICY IF EXISTS "overrides public read active" ON public.doctor_slot_overrides;
REVOKE SELECT ON public.clinics FROM anon;
REVOKE SELECT ON public.doctors FROM anon;
REVOKE SELECT ON public.doctor_slot_overrides FROM anon;