CREATE TABLE public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text,
  email text NOT NULL,
  phone text NOT NULL,
  message text,
  enquiry_type text NOT NULL CHECK (enquiry_type IN ('request_demo','sign_up')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','in_progress','converted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.enquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.enquiries TO authenticated;
GRANT ALL ON public.enquiries TO service_role;

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enquiries public insert"
  ON public.enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');

CREATE POLICY "enquiries super admin read"
  ON public.enquiries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "enquiries super admin update"
  ON public.enquiries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER enquiries_touch_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_enquiries_created_at ON public.enquiries (created_at DESC);
CREATE INDEX idx_enquiries_status ON public.enquiries (status);