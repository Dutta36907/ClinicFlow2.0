CREATE INDEX IF NOT EXISTS idx_clinics_created_at ON public.clinics USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_clinics_name ON public.clinics USING btree (name);
