-- Dynamic PDF form templates (multi-tenant)
-- Adds: uploaded PDFs, reusable templates, template fields, submissions, values, versions, and audit logs.

CREATE TYPE form_template_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE form_submission_status AS ENUM ('draft', 'finalized', 'void');
CREATE TYPE form_field_type AS ENUM (
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'checkbox',
  'radio',
  'select',
  'signature',
  'static_label',
  'repeater'
);

CREATE TABLE uploaded_pdf_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  page_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uploaded_pdf_files_mime_type_chk CHECK (mime_type = 'application/pdf')
);

CREATE INDEX idx_uploaded_pdf_files_business_id ON uploaded_pdf_files(business_id);
CREATE INDEX idx_uploaded_pdf_files_created_at ON uploaded_pdf_files(created_at DESC);

CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pdf_file_id UUID NOT NULL REFERENCES uploaded_pdf_files(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status form_template_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_templates_business_id ON form_templates(business_id);
CREATE INDEX idx_form_templates_business_status ON form_templates(business_id, status);
CREATE INDEX idx_form_templates_business_category ON form_templates(business_id, category);
CREATE INDEX idx_form_templates_updated_at ON form_templates(updated_at DESC);

CREATE TABLE form_template_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type form_field_type NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  position_x NUMERIC(12, 3) NOT NULL,
  position_y NUMERIC(12, 3) NOT NULL,
  width NUMERIC(12, 3) NOT NULL,
  height NUMERIC(12, 3) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  default_value JSONB,
  help_text TEXT,
  validation_rules JSONB,
  options JSONB,
  readonly BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  conditional_visibility JSONB,
  style JSONB,
  autofill_key TEXT,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_template_fields_unique_field_key UNIQUE (template_id, field_key),
  CONSTRAINT form_template_fields_size_chk CHECK (width > 0 AND height > 0),
  CONSTRAINT form_template_fields_page_chk CHECK (page_number > 0)
);

CREATE INDEX idx_form_template_fields_business_id ON form_template_fields(business_id);
CREATE INDEX idx_form_template_fields_template_id ON form_template_fields(template_id);
CREATE INDEX idx_form_template_fields_template_page_order ON form_template_fields(template_id, page_number, sort_order, created_at);

CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE RESTRICT,
  template_version INTEGER NOT NULL DEFAULT 1,
  status form_submission_status NOT NULL DEFAULT 'draft',
  title TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  appointment_job_id UUID REFERENCES appointments_jobs(id) ON DELETE SET NULL,
  work_order_ref TEXT,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  export_file_path TEXT,
  export_file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_submissions_business_id ON form_submissions(business_id);
CREATE INDEX idx_form_submissions_template_id ON form_submissions(template_id);
CREATE INDEX idx_form_submissions_customer_id ON form_submissions(customer_id);
CREATE INDEX idx_form_submissions_appointment_job_id ON form_submissions(appointment_job_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(business_id, status);
CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at DESC);

CREATE TABLE form_submission_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  template_field_id UUID REFERENCES form_template_fields(id) ON DELETE SET NULL,
  field_key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_submission_values_unique_submission_field UNIQUE (submission_id, field_key)
);

CREATE INDEX idx_form_submission_values_business_id ON form_submission_values(business_id);
CREATE INDEX idx_form_submission_values_submission_id ON form_submission_values(submission_id);

CREATE TABLE form_template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT form_template_versions_unique UNIQUE (template_id, version_number)
);

CREATE INDEX idx_form_template_versions_business_id ON form_template_versions(business_id);
CREATE INDEX idx_form_template_versions_template_id ON form_template_versions(template_id);

CREATE TABLE form_template_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_template_audit_logs_business_id ON form_template_audit_logs(business_id);
CREATE INDEX idx_form_template_audit_logs_template_id ON form_template_audit_logs(template_id);
CREATE INDEX idx_form_template_audit_logs_created_at ON form_template_audit_logs(created_at DESC);

CREATE TRIGGER uploaded_pdf_files_updated_at BEFORE UPDATE ON uploaded_pdf_files FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER form_templates_updated_at BEFORE UPDATE ON form_templates FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER form_template_fields_updated_at BEFORE UPDATE ON form_template_fields FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER form_submissions_updated_at BEFORE UPDATE ON form_submissions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER form_submission_values_updated_at BEFORE UPDATE ON form_submission_values FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE uploaded_pdf_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submission_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploaded_pdf_files_select"
  ON uploaded_pdf_files FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "uploaded_pdf_files_insert"
  ON uploaded_pdf_files FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "uploaded_pdf_files_update"
  ON uploaded_pdf_files FOR UPDATE
  USING (business_id = get_user_business_id());
CREATE POLICY "uploaded_pdf_files_delete"
  ON uploaded_pdf_files FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_templates_select"
  ON form_templates FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_templates_insert"
  ON form_templates FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "form_templates_update"
  ON form_templates FOR UPDATE
  USING (business_id = get_user_business_id());
CREATE POLICY "form_templates_delete"
  ON form_templates FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_template_fields_select"
  ON form_template_fields FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_template_fields_insert"
  ON form_template_fields FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "form_template_fields_update"
  ON form_template_fields FOR UPDATE
  USING (business_id = get_user_business_id());
CREATE POLICY "form_template_fields_delete"
  ON form_template_fields FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_submissions_select"
  ON form_submissions FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_submissions_insert"
  ON form_submissions FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "form_submissions_update"
  ON form_submissions FOR UPDATE
  USING (business_id = get_user_business_id());
CREATE POLICY "form_submissions_delete"
  ON form_submissions FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_submission_values_select"
  ON form_submission_values FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_submission_values_insert"
  ON form_submission_values FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "form_submission_values_update"
  ON form_submission_values FOR UPDATE
  USING (business_id = get_user_business_id());
CREATE POLICY "form_submission_values_delete"
  ON form_submission_values FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_template_versions_select"
  ON form_template_versions FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_template_versions_insert"
  ON form_template_versions FOR INSERT
  WITH CHECK (business_id = get_user_business_id());
CREATE POLICY "form_template_versions_delete"
  ON form_template_versions FOR DELETE
  USING (business_id = get_user_business_id());

CREATE POLICY "form_template_audit_logs_select"
  ON form_template_audit_logs FOR SELECT
  USING (business_id = get_user_business_id());
CREATE POLICY "form_template_audit_logs_insert"
  ON form_template_audit_logs FOR INSERT
  WITH CHECK (business_id = get_user_business_id());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('form_documents', 'form_documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "form_documents_select_own_business"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'form_documents'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "form_documents_insert_own_business"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'form_documents'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "form_documents_delete_own_business"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'form_documents'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );
