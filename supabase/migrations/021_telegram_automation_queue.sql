-- Queue-based Telegram automation for appointments, payments, support and digests.

CREATE TABLE IF NOT EXISTS public.telegram_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_telegram_notification_queue_pending
  ON public.telegram_notification_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_telegram_notification_queue_business
  ON public.telegram_notification_queue(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  digest_type text NOT NULL CHECK (digest_type IN ('daily_summary', 'morning_briefing')),
  digest_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, digest_type, digest_date)
);

CREATE TABLE IF NOT EXISTS public.telegram_limit_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, alert_key)
);

CREATE OR REPLACE FUNCTION public.enqueue_telegram_notification(
  p_business_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telegram_notification_queue (business_id, event_type, payload)
  VALUES (p_business_id, p_event_type, COALESCE(p_payload, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_enqueue_appointment_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.enqueue_telegram_notification(
    NEW.business_id,
    'appointment_created',
    jsonb_build_object('appointment_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_appointment_created ON public.appointments_jobs;
CREATE TRIGGER trg_enqueue_appointment_created
AFTER INSERT ON public.appointments_jobs
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_appointment_created();

CREATE OR REPLACE FUNCTION public.trg_enqueue_appointment_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  was_rescheduled boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('cancelled', 'no_show') THEN
    PERFORM public.enqueue_telegram_notification(
      NEW.business_id,
      'appointment_status_changed',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  was_rescheduled :=
    (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date)
    OR (OLD.start_time IS DISTINCT FROM NEW.start_time)
    OR (OLD.end_time IS DISTINCT FROM NEW.end_time)
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rescheduled');

  IF was_rescheduled THEN
    PERFORM public.enqueue_telegram_notification(
      NEW.business_id,
      'appointment_rescheduled',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'old_date', OLD.scheduled_date,
        'old_start_time', OLD.start_time,
        'old_end_time', OLD.end_time,
        'new_date', NEW.scheduled_date,
        'new_start_time', NEW.start_time,
        'new_end_time', NEW.end_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_appointment_updates ON public.appointments_jobs;
CREATE TRIGGER trg_enqueue_appointment_updates
AFTER UPDATE ON public.appointments_jobs
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_appointment_updates();

CREATE OR REPLACE FUNCTION public.trg_enqueue_payment_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.enqueue_telegram_notification(
    NEW.business_id,
    'payment_recorded',
    jsonb_build_object(
      'payment_id', NEW.id,
      'appointment_id', NEW.appointment_job_id,
      'old_paid_amount', NULL,
      'new_paid_amount', NEW.paid_amount
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_payment_insert ON public.payments;
CREATE TRIGGER trg_enqueue_payment_insert
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_payment_insert();

CREATE OR REPLACE FUNCTION public.trg_enqueue_payment_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (COALESCE(NEW.paid_amount, 0) > COALESCE(OLD.paid_amount, 0))
     OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
     OR (COALESCE(NEW.remaining_balance, 0) IS DISTINCT FROM COALESCE(OLD.remaining_balance, 0))
  THEN
    PERFORM public.enqueue_telegram_notification(
      NEW.business_id,
      'payment_recorded',
      jsonb_build_object(
        'payment_id', NEW.id,
        'appointment_id', NEW.appointment_job_id,
        'old_paid_amount', OLD.paid_amount,
        'new_paid_amount', NEW.paid_amount
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_payment_update ON public.payments;
CREATE TRIGGER trg_enqueue_payment_update
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_payment_update();

CREATE OR REPLACE FUNCTION public.trg_enqueue_support_incident()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.enqueue_telegram_notification(
    NEW.business_id,
    'support_incident_new',
    jsonb_build_object('support_request_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_support_incident ON public.support_requests;
CREATE TRIGGER trg_enqueue_support_incident
AFTER INSERT ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_support_incident();

CREATE OR REPLACE FUNCTION public.trg_enqueue_support_reply()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sender_role = 'super_admin' THEN
    PERFORM public.enqueue_telegram_notification(
      NEW.business_id,
      'support_reply',
      jsonb_build_object(
        'support_request_id', NEW.support_request_id,
        'support_message_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_support_reply ON public.support_request_messages;
CREATE TRIGGER trg_enqueue_support_reply
AFTER INSERT ON public.support_request_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_enqueue_support_reply();
