
-- 1. Extend clinics with cover image + editable stats
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS performance_stats jsonb NOT NULL DEFAULT
    '[{"label":"Years Experience","value":"15+"},{"label":"Happy Patients","value":"10k+"},{"label":"Success Rate","value":"98%"}]'::jsonb;

-- 2. Treatments table
CREATE TABLE public.clinic_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_treatments_clinic ON public.clinic_treatments(clinic_id, display_order);

GRANT SELECT ON public.clinic_treatments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_treatments TO authenticated;
GRANT ALL ON public.clinic_treatments TO service_role;

ALTER TABLE public.clinic_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatments public read"
  ON public.clinic_treatments FOR SELECT
  USING (true);

CREATE POLICY "treatments manager write"
  ON public.clinic_treatments FOR ALL TO authenticated
  USING (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Testimonials table
CREATE TABLE public.clinic_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quote text NOT NULL,
  photo_url text,
  review_date date,
  display_order int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_testimonials_clinic ON public.clinic_testimonials(clinic_id, display_order);

GRANT SELECT ON public.clinic_testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_testimonials TO authenticated;
GRANT ALL ON public.clinic_testimonials TO service_role;

ALTER TABLE public.clinic_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials public read"
  ON public.clinic_testimonials FOR SELECT
  USING (true);

CREATE POLICY "testimonials manager write"
  ON public.clinic_testimonials FOR ALL TO authenticated
  USING (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Gallery table
CREATE TABLE public.clinic_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_gallery_clinic ON public.clinic_gallery(clinic_id, display_order);

GRANT SELECT ON public.clinic_gallery TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_gallery TO authenticated;
GRANT ALL ON public.clinic_gallery TO service_role;

ALTER TABLE public.clinic_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery public read"
  ON public.clinic_gallery FOR SELECT
  USING (true);

CREATE POLICY "gallery manager write"
  ON public.clinic_gallery FOR ALL TO authenticated
  USING (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Public storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-covers', 'clinic-covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-gallery', 'clinic-gallery', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-logos', 'clinic-logos', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, manager-of-{clinic_id-folder} write
CREATE POLICY "clinic media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('clinic-covers','clinic-gallery','clinic-logos'));

CREATE POLICY "clinic media manager insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('clinic-covers','clinic-gallery','clinic-logos')
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_clinic_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'clinic_manager'::app_role)
    )
  );

CREATE POLICY "clinic media manager update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('clinic-covers','clinic-gallery','clinic-logos')
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_clinic_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'clinic_manager'::app_role)
    )
  );

CREATE POLICY "clinic media manager delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('clinic-covers','clinic-gallery','clinic-logos')
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_clinic_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'clinic_manager'::app_role)
    )
  );
