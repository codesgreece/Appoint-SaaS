-- Add unread reply flag to support_requests and simple changelog storage

ALTER TABLE public.support_requests
ADD COLUMN IF NOT EXISTS has_unread_reply boolean NOT NULL DEFAULT false;

-- Simple changelog table (optional, can be pre-seeded)
CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  visible boolean NOT NULL DEFAULT true
);

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS changelog_entries_public_read ON public.changelog_entries;

-- All authenticated users can read changelog
CREATE POLICY changelog_entries_public_read
ON public.changelog_entries
FOR SELECT
TO authenticated
USING (visible = true);

