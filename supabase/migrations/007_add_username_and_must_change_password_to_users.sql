-- Add username and must_change_password to users, with unique username per user (when set)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
  ON public.users(username)
  WHERE username IS NOT NULL;

