-- Optional address / place for the appointment (e.g. visit on-site).

ALTER TABLE public.appointments_jobs
  ADD COLUMN IF NOT EXISTS location_address TEXT;
