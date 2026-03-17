-- Ensure super_admin can insert and select users for any business (platform panel).
-- RLS stays enabled. These policies allow "Προσθήκη διαχειριστή" to work.

DROP POLICY IF EXISTS "super_admin_can_insert_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_view_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_insert_platform_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_select_platform_users" ON public.users;

CREATE POLICY "super_admin_can_insert_platform_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users AS me
    WHERE me.id = auth.uid()
      AND me.role = 'super_admin'
  )
);

CREATE POLICY "super_admin_can_select_platform_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users AS me
    WHERE me.id = auth.uid()
      AND me.role = 'super_admin'
  )
);
