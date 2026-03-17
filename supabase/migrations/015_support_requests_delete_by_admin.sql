-- Allow business admins (and super_admin of that tenant) to delete support requests
-- (e.g. Demo reset clears support history)

DROP POLICY IF EXISTS support_requests_delete_own_business_admin ON public.support_requests;

CREATE POLICY support_requests_delete_own_business_admin
ON public.support_requests
FOR DELETE
TO authenticated
USING (
  business_id = public.get_current_user_business_id()
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role IN ('admin', 'super_admin')
  )
);
