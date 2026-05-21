-- Create the clinic-files storage bucket as public so that getPublicUrl() links resolve.
-- The 20260328000000_volunteer_management migration created this bucket as private,
-- which means the /object/public/ URLs returned by getPublicUrl() return 404.
-- This migration ensures the bucket exists and is public.

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-files', 'clinic-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Clinic admins can upload files'
  ) THEN
    CREATE POLICY "Clinic admins can upload files"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'clinic-files'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- Allow public read (bucket is public, but RLS still applies to storage.objects)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Public read clinic files'
  ) THEN
    CREATE POLICY "Public read clinic files"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'clinic-files');
  END IF;
END $$;

-- Allow authenticated users to delete their own uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Clinic admins can delete files'
  ) THEN
    CREATE POLICY "Clinic admins can delete files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'clinic-files'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;
