-- Allow anonymous read of active, non-expired clinics (row-level only; column-level projection is done in code).
CREATE POLICY "clinics public read active"
ON public.clinics
FOR SELECT
TO anon, authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Allow anonymous read of active doctors whose clinic is active and not expired.
CREATE POLICY "doctors public read active"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = doctors.clinic_id
      AND c.is_active = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
);

-- Allow anonymous read of active schedules for active doctors of active clinics.
CREATE POLICY "schedules public read active"
ON public.doctor_schedules
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    JOIN public.clinics c ON c.id = d.clinic_id
    WHERE d.id = doctor_schedules.doctor_id
      AND d.is_active = true
      AND c.is_active = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
);

-- Allow anonymous read of slot overrides for active doctors of active clinics.
CREATE POLICY "overrides public read active"
ON public.doctor_slot_overrides
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.doctors d
    JOIN public.clinics c ON c.id = d.clinic_id
    WHERE d.id = doctor_slot_overrides.doctor_id
      AND d.is_active = true
      AND c.is_active = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
);

GRANT SELECT ON public.clinics TO anon;
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT ON public.doctor_schedules TO anon;
GRANT SELECT ON public.doctor_slot_overrides TO anon;