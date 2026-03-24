-- Optional link to an appointment + type for filtering / navigation.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'appointment',
  ADD COLUMN IF NOT EXISTS related_appointment_id uuid REFERENCES public.appointments_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related_appointment
  ON public.notifications (business_id, related_appointment_id)
  WHERE related_appointment_id IS NOT NULL;
