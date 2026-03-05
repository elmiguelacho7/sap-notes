CREATE OR REPLACE VIEW public.activity_risk_metrics AS
WITH metrics AS (
  SELECT
    pt.activity_id,
    COUNT(*)::integer AS total_tasks,
    (COUNT(*) FILTER (WHERE LOWER(TRIM(pt.status)) = 'done'))::integer AS done_tasks,
    (COUNT(*) FILTER (
      WHERE pt.due_date IS NOT NULL
        AND pt.due_date < current_date
        AND LOWER(TRIM(pt.status)) <> 'done'
    ))::integer AS overdue_tasks,
    (COUNT(*) FILTER (WHERE LOWER(TRIM(pt.status)) = 'blocked'))::integer AS blocked_tasks
  FROM public.project_tasks pt
  WHERE pt.activity_id IS NOT NULL
  GROUP BY pt.activity_id
),
derived AS (
  SELECT
    activity_id,
    total_tasks,
    done_tasks,
    (total_tasks - done_tasks)::integer AS open_tasks,
    overdue_tasks,
    blocked_tasks,
    COALESCE(
      ROUND(
        (overdue_tasks::numeric / NULLIF((total_tasks - done_tasks)::numeric, 0)) * 100
      )::integer,
      0
    ) AS overdue_pct
  FROM metrics
)
SELECT
  activity_id,
  total_tasks,
  done_tasks,
  open_tasks,
  overdue_tasks,
  blocked_tasks,
  overdue_pct,
  CASE
    WHEN blocked_tasks > 0 OR overdue_pct >= 30 THEN 'HIGH'
    WHEN overdue_pct >= 10 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_level
FROM derived;

COMMENT ON VIEW public.activity_risk_metrics IS
  'Per-activity risk metrics from project_tasks: total/done/open/overdue/blocked counts, overdue_pct, risk_level (HIGH/MEDIUM/LOW).';
