-- SAP Activate phases (reference data)
CREATE TABLE IF NOT EXISTS activate_phases (
  phase_key text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  duration_percent numeric(5,2) NOT NULL DEFAULT 0
);

COMMENT ON TABLE activate_phases IS 'SAP Activate methodology phases for project planning.';

-- Seed SAP Activate phases
INSERT INTO activate_phases (phase_key, name, sort_order, duration_percent) VALUES
  ('discover', 'Discover', 1, 5),
  ('prepare', 'Prepare', 2, 15),
  ('explore', 'Explore', 3, 20),
  ('realize', 'Realize', 4, 35),
  ('deploy', 'Deploy', 5, 15),
  ('run', 'Run', 6, 10)
ON CONFLICT (phase_key) DO NOTHING;

-- Activity templates: define tasks/milestones per phase
CREATE TABLE IF NOT EXISTS activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activate_phase_key text NOT NULL REFERENCES activate_phases(phase_key) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('task', 'milestone')),
  module text,
  default_duration_days int NOT NULL DEFAULT 1,
  offset_percent_in_phase numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_templates_phase ON activity_templates(activate_phase_key);
CREATE INDEX IF NOT EXISTS idx_activity_templates_active ON activity_templates(is_active) WHERE is_active = true;

-- Allow one template per (phase, name) for idempotent seed
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_templates_phase_name ON activity_templates(activate_phase_key, name);

COMMENT ON TABLE activity_templates IS 'Templates for generating project activities from SAP Activate phases.';

-- Seed a minimal set of activity templates per phase (can be extended later)
INSERT INTO activity_templates (activate_phase_key, name, type, default_duration_days, offset_percent_in_phase) VALUES
  ('discover', 'Kick-off y alineación', 'milestone', 0, 0),
  ('discover', 'Análisis de brechas inicial', 'task', 5, 10),
  ('prepare', 'Preparación del entorno', 'task', 10, 5),
  ('prepare', 'Diseño de solución (draft)', 'task', 15, 30),
  ('explore', 'Prototipos por módulo', 'task', 20, 10),
  ('explore', 'Validación con negocio', 'milestone', 0, 70),
  ('realize', 'Desarrollo y configuración', 'task', 30, 5),
  ('realize', 'Pruebas unitarias e integración', 'task', 20, 50),
  ('realize', 'UAT', 'task', 15, 80),
  ('deploy', 'Cutover y go-live', 'milestone', 0, 50),
  ('deploy', 'Hipercare inicial', 'task', 10, 60),
  ('run', 'Estabilización y cierre', 'task', 14, 20)
ON CONFLICT (activate_phase_key, name) DO NOTHING;
