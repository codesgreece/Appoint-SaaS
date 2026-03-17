-- Row Level Security: strict tenant isolation by business_id
-- Users can only access rows where business_id = their user's business_id

-- Helper: current user's business_id (uses SECURITY DEFINER to read users table)
-- Already created in 001_schema: get_user_business_id()

-- ==================== BUSINESSES ====================
-- Users see only their own business
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_business"
  ON businesses FOR SELECT
  USING (id = get_user_business_id());

CREATE POLICY "users_update_own_business"
  ON businesses FOR UPDATE
  USING (id = get_user_business_id());

-- ==================== USERS ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_same_business"
  ON users FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "users_insert_same_business"
  ON users FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "users_update_same_business"
  ON users FOR UPDATE
  USING (business_id = get_user_business_id());

-- ==================== STAFF_PROFILES ====================
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_profiles_select"
  ON staff_profiles FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "staff_profiles_insert"
  ON staff_profiles FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "staff_profiles_update"
  ON staff_profiles FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "staff_profiles_delete"
  ON staff_profiles FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== CUSTOMERS ====================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select"
  ON customers FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "customers_insert"
  ON customers FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "customers_update"
  ON customers FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "customers_delete"
  ON customers FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== SERVICES ====================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select"
  ON services FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "services_insert"
  ON services FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "services_update"
  ON services FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "services_delete"
  ON services FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== APPOINTMENTS_JOBS ====================
ALTER TABLE appointments_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_jobs_select"
  ON appointments_jobs FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "appointments_jobs_insert"
  ON appointments_jobs FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "appointments_jobs_update"
  ON appointments_jobs FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "appointments_jobs_delete"
  ON appointments_jobs FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== APPOINTMENT_JOB_COMMENTS ====================
ALTER TABLE appointment_job_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_job_comments_select"
  ON appointment_job_comments FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "appointment_job_comments_insert"
  ON appointment_job_comments FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "appointment_job_comments_delete"
  ON appointment_job_comments FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== APPOINTMENT_JOB_AUDIT_LOGS ====================
ALTER TABLE appointment_job_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_job_audit_logs_select"
  ON appointment_job_audit_logs FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "appointment_job_audit_logs_insert"
  ON appointment_job_audit_logs FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

-- ==================== PAYMENTS ====================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select"
  ON payments FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "payments_insert"
  ON payments FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "payments_update"
  ON payments FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "payments_delete"
  ON payments FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== ATTACHMENTS ====================
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select"
  ON attachments FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "attachments_insert"
  ON attachments FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "attachments_delete"
  ON attachments FOR DELETE
  USING (business_id = get_user_business_id());

-- ==================== ACTIVITY_LOGS ====================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select"
  ON activity_logs FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

-- ==================== NOTIFICATION_PREFERENCES ====================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select"
  ON notification_preferences FOR SELECT
  USING (business_id = get_user_business_id());

CREATE POLICY "notification_preferences_insert"
  ON notification_preferences FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

CREATE POLICY "notification_preferences_update"
  ON notification_preferences FOR UPDATE
  USING (business_id = get_user_business_id());

CREATE POLICY "notification_preferences_delete"
  ON notification_preferences FOR DELETE
  USING (business_id = get_user_business_id());
