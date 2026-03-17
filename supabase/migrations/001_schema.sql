-- Multi-tenant SaaS: Appointments & Jobs Management
-- Every business-related table includes business_id for tenant isolation.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'employee', 'reception');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE appointment_job_status AS ENUM (
  'pending', 'confirmed', 'in_progress', 'completed',
  'cancelled', 'no_show', 'rescheduled'
);
CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE subscription_status_enum AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'none');

-- ==================== BUSINESSES ====================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_type TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  subscription_plan TEXT,
  subscription_status subscription_status_enum DEFAULT 'none',
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  max_users INTEGER,
  max_customers INTEGER,
  max_appointments INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== USERS (linked to auth.users) ====================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  status user_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, email)
);

CREATE INDEX idx_users_business_id ON users(business_id);

-- ==================== STAFF PROFILES ====================
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  availability JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

CREATE INDEX idx_staff_profiles_business_id ON staff_profiles(business_id);

-- ==================== CUSTOMERS ====================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  area TEXT,
  postal_code TEXT,
  company TEXT,
  vat_number TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_search ON customers(business_id, first_name, last_name, email);

-- ==================== SERVICES ====================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_business_id ON services(business_id);

-- ==================== APPOINTMENTS / JOBS ====================
CREATE TABLE appointments_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status appointment_job_status NOT NULL DEFAULT 'pending',
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  cost_estimate DECIMAL(12,2),
  final_cost DECIMAL(12,2),
  creation_notes TEXT,
  completion_notes TEXT,
  recurrence_rule TEXT,
  parent_appointment_id UUID REFERENCES appointments_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_jobs_business_id ON appointments_jobs(business_id);
CREATE INDEX idx_appointments_jobs_scheduled ON appointments_jobs(business_id, scheduled_date);
CREATE INDEX idx_appointments_jobs_customer ON appointments_jobs(business_id, customer_id);
CREATE INDEX idx_appointments_jobs_assigned ON appointments_jobs(business_id, assigned_user_id);

-- ==================== APPOINTMENT JOB COMMENTS ====================
CREATE TABLE appointment_job_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_job_id UUID NOT NULL REFERENCES appointments_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointment_job_comments_business_id ON appointment_job_comments(business_id);

-- ==================== APPOINTMENT JOB AUDIT LOGS ====================
CREATE TABLE appointment_job_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_job_id UUID NOT NULL REFERENCES appointments_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT
);

CREATE INDEX idx_audit_logs_business_id ON appointment_job_audit_logs(business_id);

-- ==================== PAYMENTS ====================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_job_id UUID NOT NULL REFERENCES appointments_jobs(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT,
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
  deposit DECIMAL(12,2),
  paid_amount DECIMAL(12,2),
  remaining_balance DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_business_id ON payments(business_id);
CREATE INDEX idx_payments_appointment ON payments(business_id, appointment_job_id);

-- ==================== ATTACHMENTS ====================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_business_id ON attachments(business_id);
CREATE INDEX idx_attachments_entity ON attachments(business_id, entity_type, entity_id);

-- ==================== ACTIVITY LOGS ====================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_business_id ON activity_logs(business_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(business_id, entity_type, entity_id);

-- ==================== NOTIFICATION PREFERENCES ====================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_appointments BOOLEAN NOT NULL DEFAULT true,
  email_payments BOOLEAN NOT NULL DEFAULT true,
  email_team BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

CREATE INDEX idx_notification_preferences_business_id ON notification_preferences(business_id);

-- ==================== HELPER: get_user_business_id ====================
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ==================== UPDATED_AT TRIGGERS ====================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER staff_profiles_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER appointments_jobs_updated_at BEFORE UPDATE ON appointments_jobs FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
