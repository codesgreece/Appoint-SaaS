-- Per-business Telegram notifications (v2).
-- Keeps settings isolated per business and adds idempotency logs for scheduled jobs.

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_chat_id text,
ADD COLUMN IF NOT EXISTS telegram_morning_summary_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_night_summary_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_reminder_30min_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_new_appointment_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments_jobs(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  notification_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_telegram_notification_logs_business_id
  ON public.telegram_notification_logs (business_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_notification_logs_appointment_id
  ON public.telegram_notification_logs (appointment_id);
