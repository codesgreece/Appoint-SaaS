-- Allow super_admin to insert and select all businesses (platform management)
-- RLS stays enabled; these policies add super_admin capabilities.

CREATE POLICY "super_admin_can_insert_business"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

CREATE POLICY "super_admin_can_view_businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);
