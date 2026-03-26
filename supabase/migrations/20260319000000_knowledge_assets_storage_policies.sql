-- Storage RLS policies for knowledge-assets bucket only.
-- Goal: authenticated users can INSERT and SELECT their knowledge assets.
-- UPDATE/DELETE are restricted to rows where storage.objects.owner = auth.uid().
-- If ownership is not set by the client in your Supabase setup, UPDATE/DELETE
-- will be denied (upload + public read still work).

-- NOTE:
-- storage.objects RLS is managed by Supabase platform internals in some environments.
-- Do not run ALTER TABLE ... ENABLE ROW LEVEL SECURITY here to avoid ownership errors.

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'knowledge_assets_objects_insert_authenticated'
  ) THEN
    CREATE POLICY knowledge_assets_objects_insert_authenticated
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'knowledge-assets'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'knowledge_assets_objects_select_authenticated'
  ) THEN
    CREATE POLICY knowledge_assets_objects_select_authenticated
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'knowledge-assets'
      );
  END IF;
END $$;

-- UPDATE (own uploads only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'knowledge_assets_objects_update_own_authenticated'
  ) THEN
    CREATE POLICY knowledge_assets_objects_update_own_authenticated
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'knowledge-assets'
        AND owner = auth.uid()
      )
      WITH CHECK (
        bucket_id = 'knowledge-assets'
        AND owner = auth.uid()
      );
  END IF;
END $$;

-- DELETE (own uploads only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'knowledge_assets_objects_delete_own_authenticated'
  ) THEN
    CREATE POLICY knowledge_assets_objects_delete_own_authenticated
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'knowledge-assets'
        AND owner = auth.uid()
      );
  END IF;
END $$;

