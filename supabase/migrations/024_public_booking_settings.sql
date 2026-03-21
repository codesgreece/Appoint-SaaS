-- Public booking settings per business
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_slug text;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_requires_approval boolean NOT NULL DEFAULT true;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_window_days integer NOT NULL DEFAULT 30;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS booking_theme text NOT NULL DEFAULT 'default';

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_booking_slug
  ON public.businesses (lower(booking_slug))
  WHERE booking_slug IS NOT NULL;
