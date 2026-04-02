-- Allow super_admin to update any business row (platform panel: plan, limits, expiry, etc.).
-- Tenant policy "users_update_own_business" only matches id = get_user_business_id().

CREATE POLICY "super_admin_can_update_businesses"
ON public.businesses
FOR UPDATE
TO authenticated
USING (public.is_current_user_super_admin())
WITH CHECK (public.is_current_user_super_admin());
