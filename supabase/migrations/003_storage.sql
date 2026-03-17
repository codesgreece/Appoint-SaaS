-- Storage buckets: per-tenant folders (business_id/jobs, business_id/customers)
-- RLS on storage.objects will restrict access by business_id in path

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('attachments', 'attachments', false, 10485760, ARRAY['image/*', 'application/pdf', 'text/*']),
  ('job_photos', 'job_photos', false, 10485760, ARRAY['image/*'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access objects under their business folder
CREATE POLICY "attachments_select_own_business"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "attachments_insert_own_business"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "attachments_delete_own_business"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "job_photos_select_own_business"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job_photos'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "job_photos_insert_own_business"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job_photos'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );

CREATE POLICY "job_photos_delete_own_business"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job_photos'
    AND (storage.foldername(name))[1] = get_user_business_id()::text
  );
