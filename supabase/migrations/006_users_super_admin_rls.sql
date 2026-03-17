-- Allow super_admin to insert and select users across businesses (platform management)
-- RLS stays enabled; these policies add super_admin capabilities on top of tenant isolation.

CREATE POLICY "super_admin_can_insert_users"
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

CREATE POLICY "super_admin_can_view_users"
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

