-- Allow any authenticated user to read their own profile row.
-- This avoids lockout when business_id is NULL (e.g. super_admin).

DROP POLICY IF EXISTS "users_select_own_profile" ON public.users;

CREATE POLICY "users_select_own_profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

