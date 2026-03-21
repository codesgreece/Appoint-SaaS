-- Allow multiple services per appointment.
CREATE TABLE IF NOT EXISTS public.appointment_job_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  appointment_job_id uuid NOT NULL REFERENCES public.appointments_jobs(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_job_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_job_services_appointment
  ON public.appointment_job_services(appointment_job_id);

CREATE INDEX IF NOT EXISTS idx_appointment_job_services_business
  ON public.appointment_job_services(business_id);

ALTER TABLE public.appointment_job_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_job_services_select ON public.appointment_job_services;
CREATE POLICY appointment_job_services_select
ON public.appointment_job_services FOR SELECT
TO authenticated
USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS appointment_job_services_insert ON public.appointment_job_services;
CREATE POLICY appointment_job_services_insert
ON public.appointment_job_services FOR INSERT
TO authenticated
WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS appointment_job_services_update ON public.appointment_job_services;
CREATE POLICY appointment_job_services_update
ON public.appointment_job_services FOR UPDATE
TO authenticated
USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin())
WITH CHECK (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());

DROP POLICY IF EXISTS appointment_job_services_delete ON public.appointment_job_services;
CREATE POLICY appointment_job_services_delete
ON public.appointment_job_services FOR DELETE
TO authenticated
USING (business_id = public.get_current_user_business_id() OR public.is_current_user_super_admin());
