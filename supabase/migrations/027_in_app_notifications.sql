-- In-app notifications per business (no external services).

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notifications_business_created
  ON public.notifications (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_business_unread
  ON public.notifications (business_id)
  WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own_business"
  ON public.notifications FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "notifications_insert_own_business"
  ON public.notifications FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "notifications_update_own_business"
  ON public.notifications FOR UPDATE
  USING (business_id = get_user_business_id());
