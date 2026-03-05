-- SAP Activate plan generator: template tables and seed data.
-- These tables are read-only reference data; the generator copies from them into project_phases, project_activities, project_tasks.

-- 1) Phase templates (keys must match usage: discover, prepare, explore, realize, deploy, run)
CREATE TABLE IF NOT EXISTS public.activate_phase_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text UNIQUE NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL
);

COMMENT ON TABLE public.activate_phase_templates IS 'Templates for project_phases; phase_key is NOT NULL in project_phases.';

-- 2) Activity templates (one per phase_key; project_activities uses name, description, status, priority, start_date, due_date; no risk column)
CREATE TABLE IF NOT EXISTS public.activate_activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text NOT NULL REFERENCES public.activate_phase_templates(phase_key) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL,
  default_risk text CHECK (default_risk IS NULL OR default_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  default_status text
);

CREATE INDEX IF NOT EXISTS idx_activate_activity_templates_phase ON public.activate_activity_templates(phase_key, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activate_activity_templates_phase_name ON public.activate_activity_templates(phase_key, name);

COMMENT ON TABLE public.activate_activity_templates IS 'Templates for project_activities; project_activities has name, not title.';

-- 3) Task templates (project_tasks uses title NOT NULL, description, status, priority, due_date)
CREATE TABLE IF NOT EXISTS public.activate_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_template_id uuid NOT NULL REFERENCES public.activate_activity_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL,
  offset_days int
);

CREATE INDEX IF NOT EXISTS idx_activate_task_templates_activity ON public.activate_task_templates(activity_template_id, sort_order);

COMMENT ON TABLE public.activate_task_templates IS 'Templates for project_tasks; project_tasks uses title column.';

-- RLS: allow read for authenticated (generator runs server-side with service role)
ALTER TABLE public.activate_phase_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activate_activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activate_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activate_phase_templates_select ON public.activate_phase_templates;
CREATE POLICY activate_phase_templates_select ON public.activate_phase_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS activate_activity_templates_select ON public.activate_activity_templates;
CREATE POLICY activate_activity_templates_select ON public.activate_activity_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS activate_task_templates_select ON public.activate_task_templates;
CREATE POLICY activate_task_templates_select ON public.activate_task_templates FOR SELECT TO authenticated USING (true);

-- ========== SEED: 6 phases, ~6 activities per phase, 2–4 tasks per activity (Spanish names, ASCII keys) ==========

INSERT INTO public.activate_phase_templates (phase_key, name, sort_order) VALUES
  ('discover', 'Discover', 1),
  ('prepare', 'Prepare', 2),
  ('explore', 'Explore', 3),
  ('realize', 'Realize', 4),
  ('deploy', 'Deploy', 5),
  ('run', 'Run', 6)
ON CONFLICT (phase_key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Seed activities per phase (we need activity_template ids for task templates; use a DO block to get stable ids)
DO $$
DECLARE
  pid_disc uuid; pid_prep uuid; pid_expl uuid; pid_real uuid; pid_dep uuid; pid_run uuid;
  aid uuid;
  act_rec RECORD;
BEGIN
  FOR act_rec IN SELECT id, phase_key FROM public.activate_phase_templates ORDER BY sort_order
  LOOP
    IF act_rec.phase_key = 'discover' THEN pid_disc := act_rec.id;
    ELSIF act_rec.phase_key = 'prepare' THEN pid_prep := act_rec.id;
    ELSIF act_rec.phase_key = 'explore' THEN pid_expl := act_rec.id;
    ELSIF act_rec.phase_key = 'realize' THEN pid_real := act_rec.id;
    ELSIF act_rec.phase_key = 'deploy' THEN pid_dep := act_rec.id;
    ELSIF act_rec.phase_key = 'run' THEN pid_run := act_rec.id;
    END IF;
  END LOOP;

  INSERT INTO public.activate_activity_templates (phase_key, name, description, sort_order, default_status) VALUES
    ('discover', 'Kick-off y alineación', 'Reunión inicial y alineación con stakeholders', 1, 'planned'),
    ('discover', 'Análisis de brechas inicial', 'Análisis de brechas y requisitos iniciales', 2, 'planned'),
    ('discover', 'Evaluación de entorno', 'Evaluación del entorno SAP actual', 3, 'planned'),
    ('discover', 'Definición de alcance', 'Definición y acuerdo del alcance', 4, 'planned'),
    ('discover', 'Plan del proyecto', 'Elaboración del plan del proyecto', 5, 'planned'),
    ('discover', 'Cierre Discover', 'Revisión y cierre de fase Discover', 6, 'planned'),
    ('prepare', 'Preparación del entorno', 'Preparación y configuración del entorno', 1, 'planned'),
    ('prepare', 'Diseño de solución (borrador)', 'Diseño inicial de la solución', 2, 'planned'),
    ('prepare', 'Configuración base', 'Configuración base del sistema', 3, 'planned'),
    ('prepare', 'Migración de datos (diseño)', 'Diseño de la migración de datos', 4, 'planned'),
    ('prepare', 'Integración (diseño)', 'Diseño de integraciones', 5, 'planned'),
    ('prepare', 'Cierre Prepare', 'Revisión y cierre de fase Prepare', 6, 'planned'),
    ('explore', 'Prototipos por módulo', 'Desarrollo de prototipos por módulo', 1, 'planned'),
    ('explore', 'Validación con negocio', 'Validación con usuarios de negocio', 2, 'planned'),
    ('explore', 'Ajustes de diseño', 'Ajustes según feedback', 3, 'planned'),
    ('explore', 'Pruebas exploratorias', 'Pruebas exploratorias tempranas', 4, 'planned'),
    ('explore', 'Documentación Explore', 'Documentación de la fase Explore', 5, 'planned'),
    ('explore', 'Cierre Explore', 'Revisión y cierre de fase Explore', 6, 'planned'),
    ('realize', 'Desarrollo y configuración', 'Desarrollo y configuración detallada', 1, 'planned'),
    ('realize', 'Pruebas unitarias', 'Pruebas unitarias e integración', 2, 'planned'),
    ('realize', 'UAT', 'Pruebas de aceptación de usuario', 3, 'planned'),
    ('realize', 'Migración de datos (ejecución)', 'Ejecución de migración de datos', 4, 'planned'),
    ('realize', 'Documentación técnica', 'Documentación técnica y funcional', 5, 'planned'),
    ('realize', 'Cierre Realize', 'Revisión y cierre de fase Realize', 6, 'planned'),
    ('deploy', 'Preparación cutover', 'Preparación para cutover', 1, 'planned'),
    ('deploy', 'Cutover y go-live', 'Cutover y puesta en producción', 2, 'planned'),
    ('deploy', 'Hipercare inicial', 'Hipercare post go-live', 3, 'planned'),
    ('deploy', 'Transferencia a soporte', 'Transferencia al equipo de soporte', 4, 'planned'),
    ('deploy', 'Cierre Deploy', 'Revisión y cierre de fase Deploy', 5, 'planned'),
    ('run', 'Estabilización', 'Estabilización del sistema', 1, 'planned'),
    ('run', 'Optimización', 'Optimización y mejoras', 2, 'planned'),
    ('run', 'Cierre del proyecto', 'Cierre formal del proyecto', 3, 'planned')
  ON CONFLICT (phase_key, name) DO NOTHING;
END $$;

-- Seed task templates (2–4 tasks per activity); reference activity_templates by (phase_key, name)
-- Use upsert by (activity_template_id, sort_order) to avoid duplicates on re-run (no unique on task name)
INSERT INTO public.activate_task_templates (activity_template_id, name, description, sort_order, offset_days)
SELECT at.id, t.task_name, NULL::text, t.sort_order, t.offset_days
FROM (VALUES
  ('discover', 'Kick-off y alineación', 'Preparar agenda y materiales', 1, 0),
  ('discover', 'Kick-off y alineación', 'Ejecutar reunión kick-off', 2, 1),
  ('discover', 'Kick-off y alineación', 'Documentar acuerdos', 3, 2),
  ('discover', 'Análisis de brechas inicial', 'Recopilar requisitos', 1, 0),
  ('discover', 'Análisis de brechas inicial', 'Análisis de brechas', 2, 3),
  ('discover', 'Análisis de brechas inicial', 'Informe de brechas', 3, 5),
  ('discover', 'Evaluación de entorno', 'Inventario de sistemas', 1, 0),
  ('discover', 'Evaluación de entorno', 'Evaluación técnica', 2, 2),
  ('discover', 'Definición de alcance', 'Workshop alcance', 1, 0),
  ('discover', 'Definición de alcance', 'Documento de alcance', 2, 2),
  ('discover', 'Plan del proyecto', 'Cronograma inicial', 1, 0),
  ('discover', 'Plan del proyecto', 'Plan de recursos', 2, 1),
  ('discover', 'Plan del proyecto', 'Aprobación del plan', 3, 3),
  ('discover', 'Cierre Discover', 'Revisión de entregables', 1, 0),
  ('discover', 'Cierre Discover', 'Gate approval', 2, 1),
  ('prepare', 'Preparación del entorno', 'Solicitud de entornos', 1, 0),
  ('prepare', 'Preparación del entorno', 'Configuración inicial', 2, 5),
  ('prepare', 'Preparación del entorno', 'Validación de entornos', 3, 10),
  ('prepare', 'Diseño de solución (borrador)', 'Diseño por módulo', 1, 0),
  ('prepare', 'Diseño de solución (borrador)', 'Revisión de diseño', 2, 7),
  ('prepare', 'Diseño de solución (borrador)', 'Aprobación de diseño', 3, 14),
  ('prepare', 'Configuración base', 'Configuración global', 1, 0),
  ('prepare', 'Configuración base', 'Configuración por área', 2, 5),
  ('prepare', 'Migración de datos (diseño)', 'Especificación de migración', 1, 0),
  ('prepare', 'Migración de datos (diseño)', 'Diseño de extracción', 2, 3),
  ('prepare', 'Integración (diseño)', 'Mapa de integraciones', 1, 0),
  ('prepare', 'Integración (diseño)', 'Especificación de interfaces', 2, 5),
  ('prepare', 'Cierre Prepare', 'Revisión Prepare', 1, 0),
  ('prepare', 'Cierre Prepare', 'Gate approval', 2, 1),
  ('explore', 'Prototipos por módulo', 'Prototipo módulo 1', 1, 0),
  ('explore', 'Prototipos por módulo', 'Prototipo módulo 2', 2, 5),
  ('explore', 'Prototipos por módulo', 'Integración de prototipos', 3, 10),
  ('explore', 'Validación con negocio', 'Sesiones de validación', 1, 0),
  ('explore', 'Validación con negocio', 'Registro de feedback', 2, 3),
  ('explore', 'Ajustes de diseño', 'Ajustes de configuración', 1, 0),
  ('explore', 'Ajustes de diseño', 'Revalidación', 2, 5),
  ('explore', 'Pruebas exploratorias', 'Ejecución de pruebas', 1, 0),
  ('explore', 'Pruebas exploratorias', 'Informe de pruebas', 2, 5),
  ('explore', 'Documentación Explore', 'Documentación funcional', 1, 0),
  ('explore', 'Cierre Explore', 'Revisión Explore', 1, 0),
  ('explore', 'Cierre Explore', 'Gate approval', 2, 1),
  ('realize', 'Desarrollo y configuración', 'Configuración detallada', 1, 0),
  ('realize', 'Desarrollo y configuración', 'Desarrollo de objetos', 2, 15),
  ('realize', 'Desarrollo y configuración', 'Revisión de código', 3, 25),
  ('realize', 'Pruebas unitarias', 'Casos de prueba', 1, 0),
  ('realize', 'Pruebas unitarias', 'Ejecución pruebas unitarias', 2, 10),
  ('realize', 'Pruebas unitarias', 'Pruebas de integración', 3, 20),
  ('realize', 'UAT', 'Preparación UAT', 1, 0),
  ('realize', 'UAT', 'Ejecución UAT', 2, 5),
  ('realize', 'UAT', 'Cierre de defectos', 3, 15),
  ('realize', 'Migración de datos (ejecución)', 'Extracción', 1, 0),
  ('realize', 'Migración de datos (ejecución)', 'Carga y validación', 2, 5),
  ('realize', 'Documentación técnica', 'Manuales de usuario', 1, 0),
  ('realize', 'Documentación técnica', 'Documentación técnica', 2, 5),
  ('realize', 'Cierre Realize', 'Revisión Realize', 1, 0),
  ('realize', 'Cierre Realize', 'Gate approval', 2, 1),
  ('deploy', 'Preparación cutover', 'Plan de cutover', 1, 0),
  ('deploy', 'Preparación cutover', 'Ejecución dry-run', 2, 3),
  ('deploy', 'Cutover y go-live', 'Ejecución cutover', 1, 0),
  ('deploy', 'Cutover y go-live', 'Go-live', 2, 1),
  ('deploy', 'Hipercare inicial', 'Soporte hipercare', 1, 0),
  ('deploy', 'Hipercare inicial', 'Monitoreo', 2, 5),
  ('deploy', 'Transferencia a soporte', 'Handover documentación', 1, 0),
  ('deploy', 'Transferencia a soporte', 'Sesión de transferencia', 2, 2),
  ('deploy', 'Cierre Deploy', 'Revisión Deploy', 1, 0),
  ('run', 'Estabilización', 'Monitoreo post go-live', 1, 0),
  ('run', 'Estabilización', 'Resolución de incidencias', 2, 7),
  ('run', 'Optimización', 'Análisis de mejoras', 1, 0),
  ('run', 'Optimización', 'Implementación mejoras', 2, 5),
  ('run', 'Cierre del proyecto', 'Informe de cierre', 1, 0),
  ('run', 'Cierre del proyecto', 'Lecciones aprendidas', 2, 2)
) AS t(phase_key, act_name, task_name, sort_order, offset_days)
JOIN public.activate_activity_templates at ON at.phase_key = t.phase_key AND at.name = t.act_name
ON CONFLICT DO NOTHING;
