-- Support requests (suggestions + issues) from businesses

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_request_type') THEN
    CREATE TYPE support_request_type AS ENUM ('suggestion', 'issue');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_request_status') THEN
    CREATE TYPE support_request_status AS ENUM ('open', 'in_progress', 'resolved');
  END IF;
END$$;

-- Table
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type support_request_type NOT NULL,
  status support_request_status NOT NULL DEFAULT 'open',
  message text NOT NULL,
  -- snapshots for easier support triage
  business_name text,
  created_by_name text,
  created_by_username text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_business_id ON public.support_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON public.support_requests(created_at);

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_support_requests'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at_support_requests()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_support_requests_updated_at ON public.support_requests;
CREATE TRIGGER trg_support_requests_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_support_requests();

-- RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DROP POLICY IF EXISTS support_requests_insert_own_business ON public.support_requests;
DROP POLICY IF EXISTS support_requests_select_own_business ON public.support_requests;
DROP POLICY IF EXISTS super_admin_can_select_support_requests ON public.support_requests;
DROP POLICY IF EXISTS super_admin_can_update_support_requests ON public.support_requests;

-- Business users can create requests for their own business
CREATE POLICY support_requests_insert_own_business
ON public.support_requests
FOR INSERT
TO authenticated
WITH CHECK (
  business_id = public.get_current_user_business_id()
  AND created_by = auth.uid()
);

-- Business users can view requests for their own business
CREATE POLICY support_requests_select_own_business
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  business_id = public.get_current_user_business_id()
);

-- Super admin can view all
CREATE POLICY super_admin_can_select_support_requests
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  public.is_current_user_super_admin()
);

-- Super admin can update status/notes
CREATE POLICY super_admin_can_update_support_requests
ON public.support_requests
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_super_admin()
)
WITH CHECK (
  public.is_current_user_super_admin()
);

