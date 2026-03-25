-- Service reminders per business for follow-up maintenance.

CREATE TABLE IF NOT EXISTS public.service_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_job_id uuid REFERENCES public.appointments_jobs(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  last_contacted_at timestamptz,
  rescheduled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_reminders_business_due
  ON public.service_reminders (business_id, due_date);

CREATE INDEX IF NOT EXISTS idx_service_reminders_business_status
  ON public.service_reminders (business_id, status);

CREATE INDEX IF NOT EXISTS idx_service_reminders_customer
  ON public.service_reminders (business_id, customer_id);

CREATE TRIGGER service_reminders_updated_at
BEFORE UPDATE ON public.service_reminders
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_reminders_select
  ON public.service_reminders FOR SELECT
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY service_reminders_insert
  ON public.service_reminders FOR INSERT
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY service_reminders_update
  ON public.service_reminders FOR UPDATE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin())
  WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

CREATE POLICY service_reminders_delete
  ON public.service_reminders FOR DELETE
  USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());
