import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Projects ──────────────────────────────────────────────────
export async function getObras() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(nombre)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createObra(obra) {
  const { data, error } = await supabase.from('projects').insert([obra]).select()
  if (error) throw error
  return data[0]
}

export async function updateObra(id, updates) {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select()
  if (error) throw error
  return data[0]
}

// ── Expenses ──────────────────────────────────────────────────
export async function getGastos(obraId) {
  let query = supabase.from('expenses').select('*').order('fecha', { ascending: false })
  if (obraId) query = query.eq('project_id', obraId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createGasto(gasto) {
  const { data, error } = await supabase.from('expenses').insert([gasto]).select()
  if (error) throw error
  return data[0]
}

// ── Documents ────────────────────────────────────────────────
export async function uploadDocumento(obraId, file) {
  const fileName = `${obraId}/${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage.from('documents').upload(fileName, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)
  return { path: data.path, url: publicUrl }
}

export async function getDocumentos(obraId) {
  let query = supabase.from('documents').select('*').order('fecha', { ascending: false })
  if (obraId) query = query.eq('project_id', obraId)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ── Accounts payable / receivable ─────────────────────────────
export async function getCuentasPagar() {
  const { data, error } = await supabase
    .from('accounts_payable')
    .select('*, projects(nombre)')
    .order('fecha_vencimiento', { ascending: true })
  if (error) throw error
  return data
}

export async function getCuentasCobrar() {
  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('*, projects(nombre), clients(nombre)')
    .order('fecha_compromiso', { ascending: true })
  if (error) throw error
  return data
}

// ── Geolocation ───────────────────────────────────────────────
export async function logGeolocalizacion(entry) {
  const { error } = await supabase.from('geolocation_logs').insert([entry])
  if (error) throw error
}

/*
  ── Supabase Schema ──────────────────────────────────────────
  Run this SQL in Supabase SQL Editor to create all tables:

  CREATE TABLE clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    email text,
    telefono text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,  -- administrador | gerente | jefe_obra | contador | terreno
    permisos jsonb
  );

  CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users,
    nombre text,
    email text,
    rol_id uuid REFERENCES roles(id),
    avatar text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    client_id uuid REFERENCES clients(id),
    direccion text,
    tipo text,  -- piscina | quincho | ampliacion | remodelacion | otro
    fecha_inicio date,
    fecha_termino date,
    presupuesto numeric,
    responsable_id uuid REFERENCES users(id),
    estado text DEFAULT 'cotizada',  -- cotizada | en_ejecucion | pausada | finalizada
    lat numeric,
    lng numeric,
    descripcion text,
    avance integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    monto numeric NOT NULL,
    categoria text,  -- materiales | mano_obra | herramientas | transporte | arriendo | permisos | subcontratos | otros
    proveedor text,
    fecha date,
    medio_pago text,
    comentario text,
    documento_url text,
    lat numeric,
    lng numeric,
    usuario_id uuid REFERENCES users(id),
    estado text DEFAULT 'pendiente',
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE income (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    tipo text,  -- anticipo | estado_pago | liquidacion
    monto numeric NOT NULL,
    fecha date,
    descripcion text,
    medio_pago text,
    estado text DEFAULT 'pendiente',
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE accounts_payable (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id),
    proveedor text,
    monto numeric,
    fecha_emision date,
    fecha_vencimiento date,
    estado text DEFAULT 'pendiente',
    documento_url text,
    responsable_id uuid REFERENCES users(id),
    descripcion text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE accounts_receivable (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id),
    client_id uuid REFERENCES clients(id),
    monto_contrato numeric,
    cobrado numeric DEFAULT 0,
    saldo_pendiente numeric,
    fecha_compromiso date,
    estado text DEFAULT 'pendiente',
    descripcion text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    tipo text,  -- factura | boleta | cotizacion | contrato | foto | permiso | comprobante
    nombre text,
    archivo_url text,
    fecha date,
    proveedor text,
    monto numeric,
    categoria text,
    tamaño text,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE geolocation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id),
    expense_id uuid REFERENCES expenses(id),
    lat numeric,
    lng numeric,
    usuario_id uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now()
  );

  -- Enable RLS on all tables
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE income ENABLE ROW LEVEL SECURITY;
  ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
  ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
*/
