
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','clinic_manager','clinic_user');
CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','rescheduled','cancelled','completed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CLINICS ============
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  description TEXT,
  address TEXT,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  working_hours JSONB NOT NULL DEFAULT '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"],"sat":null,"sun":null}'::jsonb,
  appointment_duration_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, clinic_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_clinic_role(_user_id UUID, _clinic_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND clinic_id = _clinic_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_member(_user_id UUID, _clinic_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (clinic_id = _clinic_id OR role = 'super_admin')
  );
$$;

-- ============ DOCTORS ============
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  degree TEXT,
  photo_url TEXT,
  description TEXT,
  years_experience INT,
  specialization TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- ============ SCHEDULES ============
CREATE TABLE public.doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.doctor_slot_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_blocked BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_slot_overrides ENABLE ROW LEVEL SECURITY;

-- ============ APPOINTMENTS ============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT,
  notes TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appointments_clinic_scheduled_idx ON public.appointments(clinic_id, scheduled_at);
CREATE INDEX appointments_doctor_scheduled_idx ON public.appointments(doctor_id, scheduled_at);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ============ PATIENT OTP ============
CREATE TABLE public.patient_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_otp_phone_idx ON public.patient_otp(phone, created_at DESC);
ALTER TABLE public.patient_otp ENABLE ROW LEVEL SECURITY;
-- no policies => only service role (server) can touch it

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles super admin read" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

-- clinics
CREATE POLICY "clinics super admin all" ON public.clinics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "clinics members read" ON public.clinics FOR SELECT TO authenticated
  USING (public.is_clinic_member(auth.uid(), id));
CREATE POLICY "clinics manager update" ON public.clinics FOR UPDATE TO authenticated
  USING (public.has_clinic_role(auth.uid(), id, 'clinic_manager'));

-- user_roles
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles super admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "user_roles manager read clinic" ON public.user_roles FOR SELECT TO authenticated
  USING (clinic_id IS NOT NULL AND public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'));
CREATE POLICY "user_roles manager add clinic_user" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (clinic_id IS NOT NULL AND role = 'clinic_user' AND public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'));
CREATE POLICY "user_roles manager delete clinic_user" ON public.user_roles FOR DELETE TO authenticated
  USING (clinic_id IS NOT NULL AND role = 'clinic_user' AND public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'));

-- doctors
CREATE POLICY "doctors super admin all" ON public.doctors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "doctors members read" ON public.doctors FOR SELECT TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "doctors manager write" ON public.doctors FOR ALL TO authenticated
  USING (public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'))
  WITH CHECK (public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'));

-- doctor_schedules
CREATE POLICY "schedules members read" ON public.doctor_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.is_clinic_member(auth.uid(), d.clinic_id)));
CREATE POLICY "schedules manager write" ON public.doctor_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager')));

-- doctor_slot_overrides
CREATE POLICY "overrides members read" ON public.doctor_slot_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.is_clinic_member(auth.uid(), d.clinic_id)));
CREATE POLICY "overrides manager write" ON public.doctor_slot_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND public.has_clinic_role(auth.uid(), d.clinic_id, 'clinic_manager')));

-- appointments
CREATE POLICY "appointments members read" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "appointments members write" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "appointments members update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "appointments manager delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager') OR public.has_role(auth.uid(),'super_admin'));

-- audit_log
CREATE POLICY "audit super admin read all" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "audit manager read clinic" ON public.audit_log FOR SELECT TO authenticated
  USING (clinic_id IS NOT NULL AND public.has_clinic_role(auth.uid(), clinic_id, 'clinic_manager'));

-- updated_at trigger for appointments
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER appointments_touch_updated_at BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
