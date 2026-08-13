DROP POLICY IF EXISTS "appointments members read" ON public.appointments;

CREATE POLICY "appointments managers read"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);