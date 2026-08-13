DROP POLICY IF EXISTS "overrides members read" ON public.doctor_slot_overrides;

CREATE POLICY "overrides manager read" ON public.doctor_slot_overrides
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = doctor_id
      AND public.has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager'::app_role)
  )
);