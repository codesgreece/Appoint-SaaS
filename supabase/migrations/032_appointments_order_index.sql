-- Daily route ordering for today's appointments/jobs.

ALTER TABLE public.appointments_jobs
  ADD COLUMN IF NOT EXISTS order_index integer;

CREATE INDEX IF NOT EXISTS idx_appointments_jobs_business_date_order
  ON public.appointments_jobs (business_id, scheduled_date, order_index);
