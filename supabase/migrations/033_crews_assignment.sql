-- Crews (team groups) and appointment assignment to crew.

CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crews_business_id ON public.crews (business_id);

ALTER TABLE public.appointments_jobs
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_jobs_crew
  ON public.appointments_jobs (business_id, crew_id);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crews'
      AND policyname = 'crews_select'
  ) THEN
    CREATE POLICY "crews_select"
      ON public.crews FOR SELECT
      USING (business_id = get_user_business_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crews'
      AND policyname = 'crews_insert'
  ) THEN
    CREATE POLICY "crews_insert"
      ON public.crews FOR INSERT
      WITH CHECK (business_id = get_user_business_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crews'
      AND policyname = 'crews_update'
  ) THEN
    CREATE POLICY "crews_update"
      ON public.crews FOR UPDATE
      USING (business_id = get_user_business_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crews'
      AND policyname = 'crews_delete'
  ) THEN
    CREATE POLICY "crews_delete"
      ON public.crews FOR DELETE
      USING (business_id = get_user_business_id());
  END IF;
END $$;

DROP TRIGGER IF EXISTS crews_updated_at ON public.crews;
CREATE TRIGGER crews_updated_at
BEFORE UPDATE ON public.crews
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
