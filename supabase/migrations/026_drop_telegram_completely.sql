-- Remove all Telegram artifacts (tables, triggers, functions, business columns).
-- Idempotent: safe if Telegram migrations were never applied.

DROP TRIGGER IF EXISTS trg_enqueue_appointment_created ON public.appointments_jobs;
DROP TRIGGER IF EXISTS trg_enqueue_appointment_updates ON public.appointments_jobs;
DROP TRIGGER IF EXISTS trg_enqueue_payment_insert ON public.payments;
DROP TRIGGER IF EXISTS trg_enqueue_payment_update ON public.payments;
DROP TRIGGER IF EXISTS trg_enqueue_support_incident ON public.support_requests;
DROP TRIGGER IF EXISTS trg_enqueue_support_reply ON public.support_request_messages;

DROP FUNCTION IF EXISTS public.trg_enqueue_appointment_created();
DROP FUNCTION IF EXISTS public.trg_enqueue_appointment_updates();
DROP FUNCTION IF EXISTS public.trg_enqueue_payment_insert();
DROP FUNCTION IF EXISTS public.trg_enqueue_payment_update();
DROP FUNCTION IF EXISTS public.trg_enqueue_support_incident();
DROP FUNCTION IF EXISTS public.trg_enqueue_support_reply();
DROP FUNCTION IF EXISTS public.enqueue_telegram_notification(uuid, text, jsonb);

DROP TABLE IF EXISTS public.telegram_notification_queue;
DROP TABLE IF EXISTS public.telegram_digest_logs;
DROP TABLE IF EXISTS public.telegram_limit_alert_logs;
DROP TABLE IF EXISTS public.appointment_telegram_reminders;
DROP TABLE IF EXISTS public.telegram_notification_logs;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS telegram_enabled,
  DROP COLUMN IF EXISTS telegram_chat_id,
  DROP COLUMN IF EXISTS telegram_bot_token,
  DROP COLUMN IF EXISTS telegram_notification_preferences,
  DROP COLUMN IF EXISTS telegram_morning_summary_enabled,
  DROP COLUMN IF EXISTS telegram_night_summary_enabled,
  DROP COLUMN IF EXISTS telegram_reminder_30min_enabled,
  DROP COLUMN IF EXISTS telegram_new_appointment_enabled;
