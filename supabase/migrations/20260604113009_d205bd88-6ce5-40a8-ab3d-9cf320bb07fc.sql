DROP POLICY IF EXISTS "schedules manager write" ON public.doctor_schedules;
CREATE POLICY "schedules manager write" ON public.doctor_schedules
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = doctor_schedules.doctor_id
      AND has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager'::app_role)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = doctor_schedules.doctor_id
      AND has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager'::app_role)
  )
);

DROP POLICY IF EXISTS "overrides manager write" ON public.doctor_slot_overrides;
CREATE POLICY "overrides manager write" ON public.doctor_slot_overrides
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = doctor_slot_overrides.doctor_id
      AND has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager'::app_role)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = doctor_slot_overrides.doctor_id
      AND has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager'::app_role)
  )
);