-- Fix RLS recursion on public.users (42P17: infinite recursion detected in policy for relation "users").
-- Root cause: policies on public.users calling EXISTS(SELECT ... FROM public.users ...) or helpers that SELECT from users.
--
-- Strategy:
-- - Drop all recursive policies on public.users.
-- - Add SECURITY DEFINER helpers that read public.users with row_security disabled.
-- - Recreate non-recursive policies:
--   * users_can_select_own_profile
--   * users_can_update_own_profile
--   * tenant same-business policies (non-recursive)
--   * super_admin platform-wide select/insert policies (non-recursive)

-- ==================== Helpers (non-recursive) ====================
CREATE OR REPLACE FUNCTION public.get_current_user_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT business_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid() LIMIT 1), false);
$$;

-- ==================== Drop recursive/legacy policies on public.users ====================
DROP POLICY IF EXISTS "users_select_same_business" ON public.users;
DROP POLICY IF EXISTS "users_insert_same_business" ON public.users;
DROP POLICY IF EXISTS "users_update_same_business" ON public.users;

DROP POLICY IF EXISTS "users_select_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_can_select_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.users;

DROP POLICY IF EXISTS "super_admin_can_insert_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_view_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_insert_platform_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_select_platform_users" ON public.users;
DROP POLICY IF EXISTS "super_admin_can_select_all_users" ON public.users;

-- ==================== Replacement policies (non-recursive) ====================
CREATE POLICY "users_can_select_own_profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Same-business policies for normal app usage (admins/staff within business).
-- Uses SECURITY DEFINER helper to avoid recursion.
CREATE POLICY "users_select_same_business"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR business_id = public.get_current_user_business_id()
);

CREATE POLICY "users_insert_same_business"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_super_admin()
  OR business_id = public.get_current_user_business_id()
);

CREATE POLICY "users_update_same_business"
ON public.users
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_super_admin()
  OR business_id = public.get_current_user_business_id()
)
WITH CHECK (
  public.is_current_user_super_admin()
  OR business_id = public.get_current_user_business_id()
);

-- Explicit super_admin platform-wide policies (non-recursive).
CREATE POLICY "super_admin_can_select_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_current_user_super_admin()
);

CREATE POLICY "super_admin_can_insert_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_super_admin());

