-- ============================================================
-- VAION — RLS Migration: acceso por rol
-- Regla:
--   dueno       → ve y escribe todo
--   administrativo → solo proyectos donde es responsable_id,
--                    y datos vinculados a esos proyectos
-- Correr en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Helper function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_dueno()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND rol = 'dueno'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND rol = 'dueno'
  );
$$;

-- ── Drop políticas permisivas anteriores ──────────────────────
DROP POLICY IF EXISTS "auth_all" ON clients;
DROP POLICY IF EXISTS "auth_all" ON users;
DROP POLICY IF EXISTS "auth_all" ON workers;
DROP POLICY IF EXISTS "auth_all" ON projects;
DROP POLICY IF EXISTS "auth_all" ON expenses;
DROP POLICY IF EXISTS "auth_all" ON income;
DROP POLICY IF EXISTS "auth_all" ON accounts_payable;
DROP POLICY IF EXISTS "auth_all" ON accounts_receivable;
DROP POLICY IF EXISTS "auth_all" ON documents;
DROP POLICY IF EXISTS "auth_all" ON attendance;
DROP POLICY IF EXISTS "auth_all" ON geolocation_logs;
DROP POLICY IF EXISTS "authenticated full access" ON additional_sales;

-- ── Projects ──────────────────────────────────────────────────
-- dueno: todo | admin: solo proyectos donde es responsable
CREATE POLICY "projects_rls" ON projects
  FOR ALL TO authenticated
  USING (
    is_dueno() OR responsable_id = auth.uid()
  )
  WITH CHECK (
    is_dueno() OR responsable_id = auth.uid()
  );

-- ── Expenses ─────────────────────────────────────────────────
-- admin también ve sus propios gastos GAV (project_id = NULL, usuario_id = auth.uid())
CREATE POLICY "expenses_rls" ON expenses
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = expenses.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = expenses.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Additional Sales ─────────────────────────────────────────
CREATE POLICY "additional_sales_rls" ON additional_sales
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = additional_sales.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = additional_sales.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Income ───────────────────────────────────────────────────
CREATE POLICY "income_rls" ON income
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = income.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = income.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Accounts Payable ─────────────────────────────────────────
CREATE POLICY "accounts_payable_rls" ON accounts_payable
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR responsable_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = accounts_payable.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR responsable_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = accounts_payable.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Accounts Receivable ───────────────────────────────────────
CREATE POLICY "accounts_receivable_rls" ON accounts_receivable
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = accounts_receivable.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = accounts_receivable.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Documents ────────────────────────────────────────────────
-- 2026-07-13: se agregó la excepción "project_id IS NULL AND is_administrativo()"
-- para permitir subir/ver documentos generales de la empresa desde Biblioteca
-- sin asociarlos a una obra (antes solo is_dueno() podía tocar esas filas).
DROP POLICY IF EXISTS "documents_rls" ON documents;
CREATE POLICY "documents_rls" ON documents
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR (documents.project_id IS NULL AND is_administrativo())
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = documents.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR (documents.project_id IS NULL AND is_administrativo())
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = documents.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Attendance (authenticated) ────────────────────────────────
-- Las políticas anon (kiosco trabajadores) se mantienen sin cambios
--
-- 2026-07-13: se agregó is_administrativo() para que un usuario
-- administrativo pueda reasignar la obra de un turno de asistencia
-- (ControlAsistencia.jsx, panel de edición) hacia CUALQUIER obra,
-- no solo aquellas donde es responsable_id. Antes solo dueno tenía
-- ese alcance sin restricción de obra.
CREATE OR REPLACE FUNCTION public.is_administrativo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND rol = 'administrativo'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND rol = 'administrativo'
  );
$$;

DROP POLICY IF EXISTS "attendance_auth_rls" ON attendance;
CREATE POLICY "attendance_auth_rls" ON attendance
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR is_administrativo()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = attendance.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR is_administrativo()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = attendance.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Geolocation Logs ─────────────────────────────────────────
CREATE POLICY "geolocation_rls" ON geolocation_logs
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = geolocation_logs.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = geolocation_logs.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Worker Projects (tabla junction) ─────────────────────────
ALTER TABLE worker_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON worker_projects;
CREATE POLICY "worker_projects_rls" ON worker_projects
  FOR ALL TO authenticated
  USING (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = worker_projects.project_id
        AND p.responsable_id = auth.uid()
    )
  )
  WITH CHECK (
    is_dueno()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = worker_projects.project_id
        AND p.responsable_id = auth.uid()
    )
  );

-- ── Recursos compartidos ──────────────────────────────────────

-- Clients: todos los autenticados pueden leer y escribir
CREATE POLICY "clients_rls" ON clients
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Users: todos leen (para selects y asignaciones)
--        solo dueno escribe (excepto cada uno puede editarse a sí mismo)
CREATE POLICY "users_select_rls" ON users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_insert_rls" ON users
  FOR INSERT TO authenticated
  WITH CHECK (is_dueno());

CREATE POLICY "users_update_rls" ON users
  FOR UPDATE TO authenticated
  USING (is_dueno() OR id = auth.uid())
  WITH CHECK (is_dueno() OR id = auth.uid());

CREATE POLICY "users_delete_rls" ON users
  FOR DELETE TO authenticated
  USING (is_dueno());

-- Workers: todos los autenticados leen
--          solo dueno escribe
CREATE POLICY "workers_select_rls" ON workers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "workers_write_rls" ON workers
  FOR ALL TO authenticated
  USING (is_dueno())
  WITH CHECK (is_dueno());

-- Providers (tabla de proveedores): acceso completo para autenticados
ALTER TABLE IF EXISTS providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON providers;
CREATE POLICY "providers_rls" ON providers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Políticas anon (kiosco trabajadores) — SIN CAMBIOS ────────
-- anon_read_workers, anon_read_projects, anon_insert_attend,
-- anon_update_attend, anon_select_attend → permanecen intactas
