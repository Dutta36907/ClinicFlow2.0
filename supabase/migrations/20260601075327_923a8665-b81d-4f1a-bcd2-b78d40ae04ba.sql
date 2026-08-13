ALTER TABLE public.doctors
  ADD COLUMN appointment_duration_minutes integer NOT NULL DEFAULT 10
  CHECK (appointment_duration_minutes BETWEEN 5 AND 240);