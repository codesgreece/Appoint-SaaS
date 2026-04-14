-- Realtime updates for header staff presence (shifts + team count)
-- Required for instant LED counters when shifts/users change without refresh.

ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
