import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ffxexpasoneowquvtouz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zuBevuFpwaSkbokwjXNJzg_XEmRfe5h'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
  },
})

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

// ── Projects (active only, for attendance) ────────────────────
export async function getObrasActivas() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, nombre, direccion')
    .eq('estado', 'en_ejecucion')
    .order('nombre')
  if (error) throw error
  return data
}

// ── Workers ───────────────────────────────────────────────────
export async function getWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data
}

export async function getAllWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('id, nombre, avatar, valor_hora, pin, activo, created_at')
    .order('nombre')
  if (error) throw error
  return data
}

export async function createWorker(worker) {
  const { data, error } = await supabase
    .from('workers')
    .insert([worker])
    .select('id, nombre, avatar, valor_hora, pin, activo, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateWorker(id, updates) {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select('id, nombre, avatar, valor_hora, pin, activo, created_at')
    .single()
  if (error) throw error
  return data
}

// ── Worker ↔ Project assignments ──────────────────────────────
export async function getWorkerProjectIds(workerId) {
  const { data, error } = await supabase
    .from('worker_projects')
    .select('project_id')
    .eq('worker_id', workerId)
  if (error) throw error
  return data.map(r => r.project_id)
}

export async function toggleWorkerProject(workerId, projectId, assign) {
  if (assign) {
    const { error } = await supabase
      .from('worker_projects')
      .insert([{ worker_id: workerId, project_id: projectId }])
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('worker_projects')
      .delete()
      .eq('worker_id', workerId)
      .eq('project_id', projectId)
    if (error) throw error
  }
}

// Obras asignadas al trabajador (fallback: todas activas si no tiene asignaciones)
export async function getWorkerObras(workerId) {
  const { data, error } = await supabase
    .from('worker_projects')
    .select('projects(id, nombre, direccion)')
    .eq('worker_id', workerId)
  if (error) throw error
  return data.map(r => r.projects).filter(Boolean)
}

// Kiosco público: solo nombre + avatar, sin valor_hora ni PIN
export async function getPublicWorkers() {
  const { data, error } = await supabase.rpc('get_public_workers')
  if (error) throw error
  return data ?? []
}

// Verifica PIN server-side y devuelve datos del trabajador (incl. valor_hora) si es correcto
export async function verifyWorkerPin(workerId, pin) {
  const { data, error } = await supabase.rpc('verify_worker_pin', {
    p_worker_id: workerId,
    p_pin: pin,
  })
  if (error) throw error
  return data?.[0] ?? null  // null = PIN incorrecto
}

// ── Projects (simple list for selects) ───────────────────────
export async function getProjectsList() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, nombre')
    .order('nombre')
  if (error) throw error
  return data
}

// ── Attendance ────────────────────────────────────────────────
export async function getAttendance({ fecha, projectId } = {}) {
  let q = supabase
    .from('attendance')
    .select(`
      id, worker_id, project_id, fecha, entrada, salida,
      horas_trabajadas, valor_hora, costo_total,
      workers ( nombre, avatar ),
      projects ( nombre )
    `)
    .order('entrada', { ascending: false })
  if (fecha)      q = q.eq('fecha', fecha)
  if (projectId)  q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
export async function getTodayOpenAttendance(workerId) {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('worker_id', workerId)
    .eq('fecha', today)
    .is('salida', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function registrarAsistenciaManual({ workerId, projectId, fecha, horaEntrada, horaSalida, valorHora }) {
  const entradaISO = `${fecha}T${horaEntrada}:00`
  let salidaISO = null
  let horasTrabajadas = null
  let costoTotal = null

  if (horaSalida) {
    salidaISO = `${fecha}T${horaSalida}:00`
    horasTrabajadas = Math.round(((new Date(salidaISO) - new Date(entradaISO)) / 3600000) * 100) / 100
    costoTotal = Math.round(horasTrabajadas * valorHora)
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert([{
      worker_id: workerId,
      project_id: projectId,
      fecha,
      entrada: entradaISO,
      salida: salidaISO,
      horas_trabajadas: horasTrabajadas,
      valor_hora: valorHora,
      costo_total: costoTotal,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function registrarEntrada(workerId, projectId, geo, valorHora) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('attendance')
    .insert([{
      worker_id: workerId,
      project_id: projectId,
      fecha: now.split('T')[0],
      entrada: now,
      lat_entrada: geo.lat,
      lng_entrada: geo.lng,
      valor_hora: valorHora,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function registrarSalida(attendanceId, entrada, geo, valorHora) {
  const now = new Date().toISOString()
  const horasTrabajadas = Math.round(((new Date(now) - new Date(entrada)) / 3600000) * 100) / 100
  const { data, error } = await supabase
    .from('attendance')
    .update({
      salida: now,
      lat_salida: geo.lat,
      lng_salida: geo.lng,
      horas_trabajadas: horasTrabajadas,
      costo_total: Math.round(horasTrabajadas * valorHora),
    })
    .eq('id', attendanceId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getAttendanceByProject(projectId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, workers(nombre, avatar, valor_hora)')
    .eq('project_id', projectId)
    .order('entrada', { ascending: false })
  if (error) throw error
  return data
}

export async function getAllTodayAttendance() {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('attendance')
    .select('*, workers(nombre, avatar), projects(nombre)')
    .eq('fecha', today)
    .order('entrada', { ascending: false })
  if (error) throw error
  return data
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
