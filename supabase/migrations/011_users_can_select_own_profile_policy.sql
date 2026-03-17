-- Ensure any authenticated user can select their own public.users row.
-- This prevents bootstrap lockout when business_id is NULL or when tenant-only policies don't match.

DROP POLICY IF EXISTS "users_can_select_own_profile" ON public.users;

CREATE POLICY "users_can_select_own_profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

