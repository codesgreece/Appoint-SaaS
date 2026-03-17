-- Function to resolve auth email from a username without exposing full users table
-- Used for username-based login and password reset.

CREATE OR REPLACE FUNCTION public.get_auth_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email
  FROM public.users AS u
  WHERE u.username = p_username
    AND u.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_email_for_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_email_for_username(TEXT) TO anon, authenticated;

