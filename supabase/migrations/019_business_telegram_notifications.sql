-- Per-business Telegram notifications settings + reminder log table.

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Prevent duplicate "30 minutes before" notifications.
CREATE TABLE IF NOT EXISTS public.appointment_telegram_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments_jobs(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reminder_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, reminder_for)
);

CREATE INDEX IF NOT EXISTS idx_appointment_telegram_reminders_business_id
  ON public.appointment_telegram_reminders(business_id);

CREATE INDEX IF NOT EXISTS idx_appointment_telegram_reminders_reminder_for
  ON public.appointment_telegram_reminders(reminder_for);

