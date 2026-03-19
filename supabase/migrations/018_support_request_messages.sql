-- Support request chat messages (admin <-> super_admin)

-- Table
CREATE TABLE IF NOT EXISTS public.support_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id uuid NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'super_admin')),
  content TEXT NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_request_messages_support_request_id ON public.support_request_messages(support_request_id);
CREATE INDEX IF NOT EXISTS idx_support_request_messages_business_id ON public.support_request_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_support_request_messages_created_at ON public.support_request_messages(created_at);

-- Keep support_requests.updated_at fresh when new messages are added.
CREATE OR REPLACE FUNCTION public.set_updated_at_support_requests_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.support_requests
  SET updated_at = now()
  WHERE id = NEW.support_request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_request_messages_updated_at ON public.support_request_messages;
CREATE TRIGGER trg_support_request_messages_updated_at
AFTER INSERT ON public.support_request_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_support_requests_on_message();

-- RLS
ALTER TABLE public.support_request_messages ENABLE ROW LEVEL SECURITY;

-- Select messages: business admins can see their own business, super_admin can see all.
DROP POLICY IF EXISTS support_request_messages_select_own_business ON public.support_request_messages;
CREATE POLICY support_request_messages_select_own_business
ON public.support_request_messages
FOR SELECT
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR business_id = public.get_current_user_business_id()
);

-- Insert messages: business admins can insert for their own business, super_admin can insert for any.
DROP POLICY IF EXISTS support_request_messages_insert ON public.support_request_messages;
CREATE POLICY support_request_messages_insert
ON public.support_request_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    public.is_current_user_super_admin()
    OR (
      business_id = public.get_current_user_business_id()
      AND EXISTS (
        SELECT 1
        FROM public.support_requests sr
        WHERE sr.id = support_request_id
          AND sr.business_id = public.get_current_user_business_id()
          AND sr.business_id = business_id
      )
    )
  )
);

