-- ============================================================
--  Control Obras 360 — Schema completo
--  Correr en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  email      text,
  telefono   text,
  created_at timestamptz DEFAULT now()
);

-- Users (vinculados a Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nombre     text NOT NULL,
  email      text,
  rol        text NOT NULL DEFAULT 'administrativo', -- dueno | administrativo
  avatar     text,
  created_at timestamptz DEFAULT now()
);

-- Workers (terreno, sin cuenta Auth)
CREATE TABLE IF NOT EXISTS workers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  avatar     text,
  valor_hora integer NOT NULL DEFAULT 5000,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  client_id      uuid REFERENCES clients(id),
  direccion      text,
  tipo           text, -- piscina | quincho | ampliacion | remodelacion | otro
  fecha_inicio   date,
  fecha_termino  date,
  presupuesto    numeric,
  responsable_id uuid REFERENCES users(id),
  estado         text DEFAULT 'cotizada', -- cotizada | en_ejecucion | pausada | finalizada
  lat            numeric,
  lng            numeric,
  descripcion    text,
  avance         integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  monto         numeric NOT NULL,
  categoria     text, -- materiales | mano_obra | herramientas | transporte | arriendo | permisos | subcontratos | otros
  proveedor     text,
  fecha         date,
  medio_pago    text,
  comentario    text,
  documento_url text,
  lat           numeric,
  lng           numeric,
  usuario_id    uuid REFERENCES users(id),
  estado        text DEFAULT 'pendiente',
  created_at    timestamptz DEFAULT now()
);

-- Income
CREATE TABLE IF NOT EXISTS income (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  tipo        text, -- anticipo | estado_pago | liquidacion
  monto       numeric NOT NULL,
  fecha       date,
  descripcion text,
  medio_pago  text,
  estado      text DEFAULT 'pendiente',
  created_at  timestamptz DEFAULT now()
);

-- Accounts Payable
CREATE TABLE IF NOT EXISTS accounts_payable (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id),
  proveedor         text,
  monto             numeric,
  fecha_emision     date,
  fecha_vencimiento date,
  estado            text DEFAULT 'pendiente',
  documento_url     text,
  responsable_id    uuid REFERENCES users(id),
  descripcion       text,
  created_at        timestamptz DEFAULT now()
);

-- Accounts Receivable
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid REFERENCES projects(id),
  client_id        uuid REFERENCES clients(id),
  monto_contrato   numeric,
  cobrado          numeric DEFAULT 0,
  saldo_pendiente  numeric,
  fecha_compromiso date,
  estado           text DEFAULT 'pendiente',
  descripcion      text,
  created_at       timestamptz DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  tipo        text, -- factura | boleta | cotizacion | contrato | foto | permiso | comprobante
  nombre      text,
  archivo_url text,
  fecha       date,
  proveedor   text,
  monto       numeric,
  categoria   text,
  tamaño      text,
  created_at  timestamptz DEFAULT now()
);

-- Attendance (registro asistencia terreno)
CREATE TABLE IF NOT EXISTS attendance (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id        uuid REFERENCES workers(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES projects(id),
  fecha            date NOT NULL,
  entrada          timestamptz NOT NULL,
  lat_entrada      numeric,
  lng_entrada      numeric,
  salida           timestamptz,
  lat_salida       numeric,
  lng_salida       numeric,
  horas_trabajadas numeric,
  valor_hora       integer NOT NULL,
  costo_total      numeric,
  created_at       timestamptz DEFAULT now()
);

-- Geolocation Logs
CREATE TABLE IF NOT EXISTS geolocation_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id),
  expense_id  uuid REFERENCES expenses(id),
  lat         numeric,
  lng         numeric,
  usuario_id  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE income              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance          ENABLE ROW LEVEL SECURITY;
ALTER TABLE geolocation_logs    ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados: acceso completo a todo
CREATE POLICY "auth_all" ON clients             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON users               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON workers             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON projects            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON expenses            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON income              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON accounts_payable    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON accounts_receivable FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON documents           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON attendance          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON geolocation_logs    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon (trabajadores sin login): solo lo necesario para asistencia
CREATE POLICY "anon_read_workers"     ON workers    FOR SELECT TO anon USING (activo = true);
CREATE POLICY "anon_read_projects"    ON projects   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_attend"    ON attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_attend"    ON attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_select_attend"    ON attendance FOR SELECT TO anon USING (true);

-- ── Trigger: crear perfil en tabla users al registrar en Auth ─

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, nombre, rol, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'administrativo'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', upper(left(split_part(NEW.email, '@', 1), 2)))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
