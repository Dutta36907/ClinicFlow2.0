DROP POLICY IF EXISTS "appointments managers read" ON public.appointments;

CREATE POLICY "appointments members read"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.is_clinic_member(auth.uid(), clinic_id));