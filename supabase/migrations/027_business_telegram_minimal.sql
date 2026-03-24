-- Minimal per-business Telegram settings (new appointment notify only).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;
