-- Optional links to customer, payment, support; JSON metadata; super_admin can insert for tenants.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_support_request_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_customer
  ON public.notifications (business_id, related_customer_id)
  WHERE related_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_payment
  ON public.notifications (business_id, related_payment_id)
  WHERE related_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_support
  ON public.notifications (business_id, related_support_request_id)
  WHERE related_support_request_id IS NOT NULL;

-- Platform support replies: super_admin may insert notifications for any business.
CREATE POLICY "super_admin_insert_notifications_any_business"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );
