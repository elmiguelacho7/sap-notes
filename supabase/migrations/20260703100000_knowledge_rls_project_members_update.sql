-- Allow safe collaborative writes on project-linked knowledge while preserving RLS.
-- Scope intentionally limited to:
--   - public.knowledge_pages
--   - public.knowledge_blocks

ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_blocks ENABLE ROW LEVEL SECURITY;

-- knowledge_pages: owner OR project member/superadmin can update.
DROP POLICY IF EXISTS knowledge_pages_update ON public.knowledge_pages;
CREATE POLICY knowledge_pages_update ON public.knowledge_pages
FOR UPDATE
USING (
  owner_profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.knowledge_spaces ks
    WHERE ks.id = knowledge_pages.space_id
      AND ks.project_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = ks.project_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.app_role = 'superadmin'
        )
      )
  )
)
WITH CHECK (
  owner_profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.knowledge_spaces ks
    WHERE ks.id = knowledge_pages.space_id
      AND ks.project_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = ks.project_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.app_role = 'superadmin'
        )
      )
  )
);

-- knowledge_blocks INSERT: owner OR project member/superadmin on linked project page.
DROP POLICY IF EXISTS knowledge_blocks_insert ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_insert ON public.knowledge_blocks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.knowledge_pages kp
    JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
    WHERE kp.id = knowledge_blocks.page_id
      AND (
        kp.owner_profile_id = auth.uid()
        OR (
          ks.project_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.project_members pm
              WHERE pm.project_id = ks.project_id
                AND pm.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.app_role = 'superadmin'
            )
          )
        )
      )
  )
);

-- knowledge_blocks UPDATE: owner OR project member/superadmin on linked project page.
DROP POLICY IF EXISTS knowledge_blocks_update ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_update ON public.knowledge_blocks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.knowledge_pages kp
    JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
    WHERE kp.id = knowledge_blocks.page_id
      AND (
        kp.owner_profile_id = auth.uid()
        OR (
          ks.project_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.project_members pm
              WHERE pm.project_id = ks.project_id
                AND pm.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.app_role = 'superadmin'
            )
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.knowledge_pages kp
    JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
    WHERE kp.id = knowledge_blocks.page_id
      AND (
        kp.owner_profile_id = auth.uid()
        OR (
          ks.project_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.project_members pm
              WHERE pm.project_id = ks.project_id
                AND pm.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.app_role = 'superadmin'
            )
          )
        )
      )
  )
);

-- knowledge_blocks DELETE: owner OR project member/superadmin on linked project page.
DROP POLICY IF EXISTS knowledge_blocks_delete ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_delete ON public.knowledge_blocks
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.knowledge_pages kp
    JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
    WHERE kp.id = knowledge_blocks.page_id
      AND (
        kp.owner_profile_id = auth.uid()
        OR (
          ks.project_id IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.project_members pm
              WHERE pm.project_id = ks.project_id
                AND pm.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.app_role = 'superadmin'
            )
          )
        )
      )
  )
);
