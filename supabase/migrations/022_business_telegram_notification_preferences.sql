-- Per-business Telegram notification preferences.
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS telegram_notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
  'appointment_created', true,
  'appointment_cancelled_or_no_show', true,
  'appointment_rescheduled', true,
  'payment_recorded', true,
  'support_incident_new', true,
  'support_reply', true,
  'daily_summary', true,
  'morning_briefing', true,
  'plan_limits', true,
  'subscription_alerts', true,
  'reminder_30m', true
);
