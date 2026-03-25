-- Simple shift management per staff member/day.

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'off')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_business_date
  ON public.shifts (business_id, date);

CREATE INDEX IF NOT EXISTS idx_shifts_business_user_date
  ON public.shifts (business_id, user_id, date);

CREATE TRIGGER shifts_updated_at
BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_select
  ON public.shifts FOR SELECT
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY shifts_insert
  ON public.shifts FOR INSERT
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY shifts_update
  ON public.shifts FOR UPDATE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin())
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY shifts_delete
  ON public.shifts FOR DELETE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());
