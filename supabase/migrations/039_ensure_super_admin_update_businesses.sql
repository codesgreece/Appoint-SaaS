-- Ensure super_admin can UPDATE businesses (idempotent).
-- Without this policy, PostgREST updates 0 rows with no error — platform panel "saves" appear to do nothing.
-- Safe to re-run: replaces the policy if it already exists.

DROP POLICY IF EXISTS "super_admin_can_update_businesses" ON public.businesses;

CREATE POLICY "super_admin_can_update_businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());
