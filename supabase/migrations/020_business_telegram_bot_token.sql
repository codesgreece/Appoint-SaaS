-- Per-business Telegram bot token (optional override of global token).

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS telegram_bot_token text;

