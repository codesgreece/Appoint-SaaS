-- Advanced Public Booking controls and per-service visibility.
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_start_hour integer NOT NULL DEFAULT 9;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_end_hour integer NOT NULL DEFAULT 20;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_slot_interval_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_min_notice_hours integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_booking_hours_check'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_booking_hours_check
    CHECK (
      booking_start_hour >= 0
      AND booking_start_hour <= 23
      AND booking_end_hour >= 1
      AND booking_end_hour <= 24
      AND booking_end_hour > booking_start_hour
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_booking_slot_interval_check'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_booking_slot_interval_check
    CHECK (booking_slot_interval_minutes IN (5, 10, 15, 20, 30, 60));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_booking_min_notice_check'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_booking_min_notice_check
    CHECK (booking_min_notice_hours >= 0 AND booking_min_notice_hours <= 168);
  END IF;
END $$;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS is_public_booking_visible boolean NOT NULL DEFAULT true;
