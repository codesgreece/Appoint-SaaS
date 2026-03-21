-- Track unread appointments that come from public booking page.
ALTER TABLE public.appointments_jobs
ADD COLUMN IF NOT EXISTS public_booking_unread boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_jobs_public_booking_unread
  ON public.appointments_jobs(business_id, public_booking_unread);
