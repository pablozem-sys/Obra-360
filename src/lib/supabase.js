import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ffxexpasoneowquvtouz.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_zuBevuFpwaSkbokwjXNJzg_XEmRfe5h'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})

// ── Multi-tenancy ─────────────────────────────────────────────
let currentEmpresaId = null

export function setEmpresaId(id) {
  currentEmpresaId = id
}

export async function getUserCompanies(userId) {
  const { data: memberships, error: e1 } = await supabase
    .from('user_companies')
    .select('rol, empresa_id')
    .eq('user_id', userId)
  if (e1) throw e1
  if (!memberships?.length) return []

  const ids = memberships.map(m => m.empresa_id)
  const { data: companies, error: e2 } = await supabase
    .from('companies')
    .select('id, nombre, slug')
    .in('id', ids)
  if (e2) throw e2

  return memberships.map(m => {
    const co = (companies ?? []).find(c => c.id === m.empresa_id)
    return { empresa_id: m.empresa_id, nombre: co?.nombre, slug: co?.slug, rol: m.rol }
  })
}

// ── Projects ──────────────────────────────────────────────────
export async function getObras() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createObra(obra) {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...obra, empresa_id: currentEmpresaId }])
    .select()
  if (error) throw error
  return data[0]
}

export async function updateObra(id, updates) {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select()
  if (error) throw error
  return data[0]
}

export async function deleteObra(id) {
  const { error } = await supabase.rpc('delete_obra', { p_project_id: id })
  if (error) throw error
}

export async function deleteWorker(id) {
  const { error } = await supabase.rpc('delete_worker', { p_worker_id: id })
  if (error) throw error
}

// ── Additional Sales ──────────────────────────────────────────
export async function getAdditionalSales(projectId) {
  const { data, error } = await supabase
    .from('additional_sales')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getAllAdditionalSales() {
  const { data, error } = await supabase
    .from('additional_sales')
    .select('project_id, monto, tipo')
  if (error) throw error
  return data ?? []
}

export async function createAdditionalSale(sale) {
  const { data, error } = await supabase
    .from('additional_sales')
    .insert([sale])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdditionalSale(id) {
  const { error } = await supabase.from('additional_sales').delete().eq('id', id)
  if (error) throw error
}

// ── Expenses ──────────────────────────────────────────────────
export async function getGastos(obraId) {
  let query = supabase.from('expenses').select('*')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha', { ascending: false })
  if (obraId) query = query.eq('project_id', obraId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getEgresosCredito() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, projects(id, nombre)')
    .eq('empresa_id', currentEmpresaId)
    .eq('medio_pago', 'credito')
    .order('fecha', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getGastosDetallado({ obraId, fechaDesde, fechaHasta } = {}) {
  let query = supabase
    .from('expenses')
    .select('*, projects(id, nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha', { ascending: false })
  if (obraId)     query = query.eq('project_id', obraId)
  if (fechaDesde) query = query.gte('fecha', fechaDesde)
  if (fechaHasta) query = query.lte('fecha', fechaHasta)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createGasto(gasto) {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ ...gasto, empresa_id: currentEmpresaId }])
    .select()
  if (error) throw error
  return data[0]
}

export async function updateGasto(id, updates) {
  const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteGasto(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
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
  let query = supabase.from('documents').select('*')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha', { ascending: false })
  if (obraId) query = query.eq('project_id', obraId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createDocumento(doc) {
  const { data, error } = await supabase
    .from('documents')
    .insert([{ ...doc, empresa_id: currentEmpresaId }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDocumento(doc) {
  if (doc.archivo_url) {
    const marker = '/object/public/documents/'
    const idx = doc.archivo_url.indexOf(marker)
    if (idx !== -1) {
      const path = decodeURIComponent(doc.archivo_url.slice(idx + marker.length))
      await supabase.storage.from('documents').remove([path]).catch(() => {})
    }
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}

export async function getExpensasPorObraLite() {
  const { data, error } = await supabase
    .from('expenses')
    .select('project_id, monto, categoria')
    .eq('empresa_id', currentEmpresaId)
    .not('project_id', 'is', null)
  if (error) throw error
  return data ?? []
}

export async function getAttendanceCostsPorObra() {
  const { data, error } = await supabase
    .from('attendance')
    .select('project_id, costo_total')
    .not('project_id', 'is', null)
    .not('costo_total', 'is', null)
  if (error) throw error
  return data ?? []
}

// ── Accounts payable / receivable ─────────────────────────────
export async function getCuentasPagar() {
  const { data, error } = await supabase
    .from('accounts_payable')
    .select('*, projects(nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha_vencimiento', { ascending: true })
  if (error) throw error
  return data
}

export async function getIngresos() {
  const { data, error } = await supabase
    .from('income')
    .select('*, projects(nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createIngreso(ingreso) {
  const { data, error } = await supabase
    .from('income')
    .insert([{ ...ingreso, empresa_id: currentEmpresaId }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIngreso(id, updates) {
  const { data, error } = await supabase
    .from('income')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteIngreso(id) {
  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) throw error
}

// ── Users ─────────────────────────────────────────────────────
export async function getUsuarios() {
  const { data, error } = await supabase
    .from('user_companies')
    .select('rol, users(id, nombre, email, avatar)')
    .eq('empresa_id', currentEmpresaId)
  if (error) throw error
  return (data ?? [])
    .map(uc => ({ ...uc.users, rol: uc.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function createUsuario({ email, password, nombre, rol }) {
  const tmp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-tmp-create' },
  })
  const { data, error } = await tmp.auth.signUp({ email, password })
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('No se pudo crear el usuario')

  // Inserta perfil via RPC SECURITY DEFINER (bypasea RLS y FK timing)
  const { error: rpcError } = await supabase.rpc('create_user_profile', {
    user_id:     userId,
    user_email:  email.trim().toLowerCase(),
    user_nombre: nombre.trim(),
    user_rol:    rol,
    user_avatar: nombre.trim().slice(0, 2).toUpperCase(),
  })
  if (rpcError) throw rpcError

  // Vincula al usuario con la empresa actual
  if (currentEmpresaId) {
    const { error: linkError } = await supabase
      .from('user_companies')
      .insert([{ user_id: userId, empresa_id: currentEmpresaId, rol }])
    if (linkError) throw linkError
  }

  return data.user
}

export async function deleteUsuario(id) {
  const { error } = await supabase.rpc('delete_user', { user_id: id })
  if (error) throw error
}

export async function updateUsuarioPerfil(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCuentaPagar(id, updates) {
  const { data, error } = await supabase.from('accounts_payable').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function getCuentasCobrar() {
  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('*, projects(nombre), clients(nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha_compromiso', { ascending: true })
  if (error) throw error
  return data
}

// ── Geolocation ───────────────────────────────────────────────
export async function updateCuentaCobrar(id, updates) {
  const { data, error } = await supabase.from('accounts_receivable').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function logGeolocalizacion(entry) {
  const { error } = await supabase.from('geolocation_logs').insert([entry])
  if (error) throw error
}

// ── Projects (active only, for attendance) ────────────────────
export async function getObrasActivas() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, nombre, direccion, clave')
    .eq('empresa_id', currentEmpresaId)
    .eq('estado', 'en_ejecucion')
    .order('nombre')
  if (error) throw error
  return data
}

export async function getObraByClaveActiva(clave) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, nombre, direccion')
    .eq('clave', clave)
    .eq('estado', 'en_ejecucion')
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Workers ───────────────────────────────────────────────────
export async function getWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('empresa_id', currentEmpresaId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data
}

export async function getAllWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('id, nombre, avatar, valor_hora, pin, activo, created_at')
    .eq('empresa_id', currentEmpresaId)
    .order('nombre')
  if (error) throw error
  return data
}

export async function createWorker(worker) {
  const { data, error } = await supabase
    .from('workers')
    .insert([{ ...worker, empresa_id: currentEmpresaId }])
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

// Verifica PIN solo (sin seleccionar trabajador de lista).
// Requiere crear esta función en Supabase SQL Editor:
//
//   CREATE OR REPLACE FUNCTION verify_worker_pin_only(p_pin text)
//   RETURNS TABLE(id uuid, nombre text, avatar text, valor_hora numeric)
//   LANGUAGE sql SECURITY DEFINER AS $$
//     SELECT id, nombre, avatar, valor_hora
//     FROM workers WHERE pin = p_pin AND activo = true LIMIT 1;
//   $$;
//   GRANT EXECUTE ON FUNCTION verify_worker_pin_only TO anon;
export async function verifyWorkerPinSolo(pin) {
  const { data, error } = await supabase.rpc('verify_worker_pin_only', { p_pin: pin })
  if (error) throw error
  return data?.[0] ?? null
}

// ── Baños Químicos ────────────────────────────────────────────
export async function getActiveBanoByProject(projectId) {
  const { data, error } = await supabase
    .from('banos_quimicos')
    .select('id, monto_mensual, proveedor')
    .eq('empresa_id', currentEmpresaId)
    .eq('project_id', projectId)
    .eq('estado', 'activo')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getBanosQuimicos() {
  const { data, error } = await supabase
    .from('banos_quimicos')
    .select('*, projects(id, nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBanoQuimico(bano) {
  const { data, error } = await supabase
    .from('banos_quimicos')
    .insert([{ ...bano, empresa_id: currentEmpresaId }])
    .select('*, projects(id, nombre)')
    .single()
  if (error) throw error
  return data
}

export async function updateBanoQuimico(id, updates) {
  const { data, error } = await supabase
    .from('banos_quimicos')
    .update(updates)
    .eq('id', id)
    .select('*, projects(id, nombre)')
    .single()
  if (error) throw error
  return data
}

export async function deleteBanoQuimico(id) {
  const { error } = await supabase.from('banos_quimicos').delete().eq('id', id)
  if (error) throw error
}

export async function getPagosBano(banoId) {
  const { data, error } = await supabase
    .from('banos_quimicos_pagos')
    .select('*')
    .eq('bano_id', banoId)
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createPagoBano(pago) {
  const { data, error } = await supabase
    .from('banos_quimicos_pagos')
    .insert([pago])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePagoBano(id) {
  const { error } = await supabase.from('banos_quimicos_pagos').delete().eq('id', id)
  if (error) throw error
}

// ── Tasks ─────────────────────────────────────────────────────
export async function getTareas() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, projects(id, nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTarea(tarea) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ ...tarea, empresa_id: currentEmpresaId }])
    .select('*, projects(id, nombre)')
    .single()
  if (error) throw error
  return data
}

export async function updateTarea(id, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('*, projects(id, nombre)')
    .single()
  if (error) throw error
  return data
}

export async function deleteTarea(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ── Providers ─────────────────────────────────────────────────
export async function getProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, nombre')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function upsertProvider(nombre) {
  const { error } = await supabase
    .from('providers')
    .upsert([{ nombre }], { onConflict: 'nombre', ignoreDuplicates: true })
  if (error) throw error
}

// ── Projects (simple list for selects) ───────────────────────
export async function getProjectsList() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, nombre')
    .eq('empresa_id', currentEmpresaId)
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
function localDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getTodayOpenAttendance(workerId) {
  const today = localDateString()
  const { data, error } = await supabase
    .from('attendance')
    .select('*, projects(id, nombre, direccion)')
    .eq('worker_id', workerId)
    .eq('fecha', today)
    .is('salida', null)
    .maybeSingle()
  if (error) throw error
  return data
}

function localOffset() {
  const off = new Date().getTimezoneOffset()
  const sign = off <= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

export async function registrarAsistenciaManual({ workerId, projectId, fecha, horaEntrada, horaSalida, valorHora }) {
  const tz = localOffset()
  const entradaISO = `${fecha}T${horaEntrada}:00${tz}`
  let salidaISO = null
  let horasTrabajadas = null
  let costoTotal = null

  if (horaSalida) {
    salidaISO = `${fecha}T${horaSalida}:00${tz}`
    horasTrabajadas = Math.round(((new Date(salidaISO) - new Date(entradaISO)) / 3600000) * 100) / 100
    costoTotal = horasTrabajadas >= 8 ? valorHora : Math.round((horasTrabajadas / 8) * valorHora)
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
      fecha: localDateString(),
      entrada: now,
      lat_entrada: geo?.lat ?? null,
      lng_entrada: geo?.lng ?? null,
      valor_hora: valorHora,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarSalidaManual(attendanceId, entrada, fecha, horaSalida, valorHora) {
  const salidaISO = `${fecha}T${horaSalida}:00${localOffset()}`
  const horasTrabajadas = Math.round(((new Date(salidaISO) - new Date(entrada)) / 3600000) * 100) / 100
  const { data, error } = await supabase
    .from('attendance')
    .update({
      salida: salidaISO,
      horas_trabajadas: horasTrabajadas,
      costo_total: horasTrabajadas >= 8 ? valorHora : Math.round((horasTrabajadas / 8) * valorHora),
    })
    .eq('id', attendanceId)
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
      lat_salida: geo?.lat ?? null,
      lng_salida: geo?.lng ?? null,
      horas_trabajadas: horasTrabajadas,
      costo_total: horasTrabajadas >= 8 ? valorHora : Math.round((horasTrabajadas / 8) * valorHora),
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

export async function getAttendanceRange({ desde, hasta, projectId } = {}) {
  let q = supabase
    .from('attendance')
    .select(`
      id, worker_id, project_id, fecha, entrada, salida,
      horas_trabajadas, valor_hora, costo_total,
      workers ( nombre, avatar ),
      projects ( nombre )
    `)
    .order('fecha', { ascending: false })
    .order('entrada', { ascending: true })
  if (desde)      q = q.gte('fecha', desde)
  if (hasta)      q = q.lte('fecha', hasta)
  if (projectId)  q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
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
