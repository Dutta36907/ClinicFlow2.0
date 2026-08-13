DROP POLICY IF EXISTS "clinics members read" ON public.clinics;

CREATE POLICY "clinics managers read"
ON public.clinics
FOR SELECT
TO authenticated
USING (
  public.has_clinic_role(auth.uid(), id, 'clinic_manager')
  OR public.has_role(auth.uid(), 'super_admin')
);