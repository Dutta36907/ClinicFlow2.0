-- Add WITH CHECK clauses to UPDATE policies that only had USING.
-- Without WITH CHECK, a permitted UPDATE can rewrite the row's
-- access-key columns (e.g. clinic_id) to a value the user wouldn't be
-- allowed to INSERT, sliding rows between tenants the user belongs to.

ALTER POLICY "appointments members update" ON public.appointments
  WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

ALTER POLICY "clinics manager update" ON public.clinics
  WITH CHECK (has_clinic_role(auth.uid(), id, 'clinic_manager'::app_role));

ALTER POLICY "profiles self update" ON public.profiles
  WITH CHECK (id = auth.uid());

ALTER POLICY "enquiries super admin update" ON public.enquiries
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));