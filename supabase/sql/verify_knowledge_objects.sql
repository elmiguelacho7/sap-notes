-- Run in Supabase SQL Editor to verify Knowledge + search + graph objects

-- Tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'knowledge_spaces', 'knowledge_pages', 'knowledge_blocks', 'knowledge_tags',
    'knowledge_page_tags', 'knowledge_page_links', 'knowledge_page_projects'
  )
ORDER BY table_name;

-- search_vector column + trigger + GIN index on knowledge_pages
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'knowledge_pages' AND column_name = 'search_vector';

SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'knowledge_pages'
  AND trigger_name LIKE '%search%';

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'knowledge_pages'
  AND (indexdef LIKE '%search_vector%' OR indexdef ILIKE '%gin%');

-- Views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('knowledge_search_view', 'knowledge_graph_view');

-- Optional: RPC search_knowledge
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'search_knowledge';
