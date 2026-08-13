-- G1: Restrict public marketing reads to active, non-expired clinics
DROP POLICY IF EXISTS "Public read clinic_treatments" ON public.clinic_treatments;
DROP POLICY IF EXISTS "Public read clinic_testimonials" ON public.clinic_testimonials;
DROP POLICY IF EXISTS "Public read clinic_gallery" ON public.clinic_gallery;

CREATE POLICY "Public read active clinic_treatments"
  ON public.clinic_treatments FOR SELECT TO anon, authenticated
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_treatments.clinic_id
        AND c.is_active = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

CREATE POLICY "Public read active clinic_testimonials"
  ON public.clinic_testimonials FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_testimonials.clinic_id
        AND c.is_active = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

CREATE POLICY "Public read active clinic_gallery"
  ON public.clinic_gallery FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_gallery.clinic_id
        AND c.is_active = true
        AND (c.expires_at IS NULL OR c.expires_at > now())
    )
  );

-- G2: Lock clinic slug after creation (super admins can still rename)
CREATE OR REPLACE FUNCTION public.prevent_clinic_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Clinic slug is immutable after creation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_clinic_slug ON public.clinics;
CREATE TRIGGER lock_clinic_slug
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinic_slug_change();