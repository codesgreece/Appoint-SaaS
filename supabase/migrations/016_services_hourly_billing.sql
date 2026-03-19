-- Add billing mode support for services (fixed price vs hourly rate).
ALTER TABLE services
ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'fixed';

ALTER TABLE services
ADD COLUMN hourly_rate DECIMAL(12,2);

ALTER TABLE services
ADD CONSTRAINT services_billing_type_check
CHECK (billing_type IN ('fixed', 'hourly'));
