import { createClient } from '@supabase/supabase-js'
import { COMPANY_SLUG, horasBaseJornada } from './helpers'
// Import circular con logger.js (logger importa `supabase` de acá) — seguro
// porque ambos usos ocurren dentro de closures llamadas en runtime, nunca
// en el cuerpo top-level de ninguno de los dos módulos.
import { logError } from './logger'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'La app no puede arrancar sin ellas — no hay fallback a producción. ' +
    'Copiá .env.example a .env.local y completá los valores (ver docs/INFRASTRUCTURE.md).'
  )
}

// 'production' | 'staging' | 'local' — sin VITE_ENV configurada se asume 'local'
// (nunca 'production' por defecto, para que el banner de ambiente de pruebas
// se muestre ante la duda en vez de ocultarse).
export const VITE_ENV = import.meta.env.VITE_ENV || 'local'
export const IS_PRODUCTION = VITE_ENV === 'production'

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

export async function getObraById(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(nombre)')
    .eq('id', id)
    .single()
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

export async function getUltimosGastos(limit = 6) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, projects(id, nombre)')
    .eq('empresa_id', currentEmpresaId)
    .order('fecha', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Totales acumulados por obra (CDO, MOD, ventas adicionales, descuentos, abonos)
// calculados en Postgres vía RPC en vez de traer el historial completo de
// expenses/attendance/additional_sales/income al navegador. Reemplaza a
// getExpensasPorObraLite() + getAttendanceCostsPorObra() + getAllAdditionalSales() + getIngresos()
// cuando se necesitan totales por obra (Obras.jsx, alertas/progreso de Dashboard.jsx).
export async function getObraMetrics() {
  const { data, error } = await supabase.rpc('get_obra_metrics', { p_empresa_id: currentEmpresaId })
  if (error) throw error
  const byObra = {}
  for (const row of data ?? []) {
    byObra[row.project_id] = {
      cdo: row.cdo ?? 0,
      mod: row.costo_mod ?? 0,
      adicionales: row.adicionales ?? 0,
      descuentos: row.descuentos ?? 0,
      abonos: row.abonos ?? 0,
    }
  }
  return byObra
}

// KPIs de empresa (Dashboard Fila 1/2), agregados en Postgres. mes en formato 'YYYY-MM' o null (todo).
export async function getDashboardKPIs(mes = null) {
  const { data, error } = await supabase
    .rpc('get_dashboard_kpis', { p_empresa_id: currentEmpresaId, p_month: mes })
    .single()
  if (error) throw error
  return {
    ventaAdicional: data?.venta_adicional ?? 0,
    totalAbonos:    data?.total_abonos ?? 0,
    totalManoObra:  data?.total_mano_obra ?? 0,
    gastosCDO:      data?.gastos_cdo ?? 0,
    gastosGAV:      data?.gastos_gav ?? 0,
    totalGastos:    data?.total_gastos ?? 0,
  }
}

export async function getMesesDisponibles() {
  const { data, error } = await supabase.rpc('get_meses_disponibles', { p_empresa_id: currentEmpresaId })
  if (error) throw error
  return (data ?? []).map(r => r.mes)
}

// Series de tiempo para FlujoCaja.jsx, agregadas en Postgres (solo los últimos N períodos
// con datos, no el historial completo). Devuelven los períodos más recientes primero.
export async function getFlujoCajaMensual(meses = 8) {
  const { data, error } = await supabase.rpc('get_flujo_caja_mensual', { p_empresa_id: currentEmpresaId, p_meses: meses })
  if (error) throw error
  return data ?? []
}

export async function getFlujoCajaSemanal(semanas = 8) {
  const { data, error } = await supabase.rpc('get_flujo_caja_semanal', { p_empresa_id: currentEmpresaId, p_semanas: semanas })
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

// Bucket 'documents' es privado (Fase 3) — las URLs guardadas en DB tienen
// el formato viejo de URL pública, pero solo se usa el path que traen para
// borrar del storage o para pedir una URL firmada nueva.
function extraerPathDocumento(value) {
  if (!value) return null
  const marker = '/object/public/documents/'
  const idx = value.indexOf(marker)
  return idx !== -1 ? decodeURIComponent(value.slice(idx + marker.length)) : value
}

export async function deleteDocumento(doc) {
  const path = extraerPathDocumento(doc.archivo_url)
  if (path) {
    await supabase.storage.from('documents').remove([path]).catch(() => {})
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id)
  if (error) throw error
}

// Genera una URL firmada de corta duración para ver/descargar un documento
// del bucket privado. Acepta tanto el formato viejo de URL pública (docs
// subidos antes de Fase 3) como un path bare.
export async function getSignedDocUrl(urlOrPath, { download } = {}) {
  const path = extraerPathDocumento(urlOrPath)
  if (!path) return null
  const { data, error } = await supabase.storage.from('documents')
    .createSignedUrl(path, 3600, download ? { download: true } : undefined)
  if (error) throw error
  return data.signedUrl
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

export async function getIngresos(projectId) {
  let query = supabase
    .from('income')
    .select('*, projects(nombre)')
    .eq('empresa_id', currentEmpresaId)
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('fecha', { ascending: false })
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

export async function updateCuentaCobrar(id, updates) {
  const { data, error } = await supabase.from('accounts_receivable').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Projects (active only, for attendance) ────────────────────
export async function getObrasActivas() {
  let q = supabase
    .from('projects')
    .select('id, nombre, direccion, estado')
    .neq('estado', 'finalizada')
    .order('nombre')
  if (currentEmpresaId) q = q.eq('empresa_id', currentEmpresaId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
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

// Kiosco: obras asignadas al trabajador. Fase 3 — pasa por RPC con el
// token de sesión de kiosco (ver worker_kiosk_sessions), ya no lee
// worker_projects directo como `anon`.
export async function getWorkerObras(workerId, sessionToken) {
  const { data, error } = await supabase.rpc('kiosko_get_obras', {
    p_worker_id: workerId,
    p_token: sessionToken,
  })
  if (error) throw error
  return data ?? []
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
// Escopado por empresa (COMPANY_SLUG) para que el kiosco de una plataforma
// (VAION/VRION) nunca pueda devolver un trabajador de la otra empresa.
// Desde Fase 3 (supabase/migrations/20260831143609_fase3_kiosco_storage.sql)
// además abre una sesión de kiosco y devuelve `session_token` — el resto
// de las operaciones del kiosco (ver getWorkerObras/getTodayOpenAttendance/
// registrarEntrada/registrarSalida) lo requieren para poder ejecutarse.
export async function verifyWorkerPinSolo(pin) {
  const { data, error } = await supabase.rpc('verify_worker_pin_only', {
    p_pin: pin,
    p_company_slug: COMPANY_SLUG,
  })
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
    .select('id, nombre, estado')
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
      horas_trabajadas, valor_hora, costo_total, bono,
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
export function localDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Kiosco: turno abierto de hoy. Fase 3 — pasa por RPC con el token de
// sesión de kiosco, ya no lee attendance directo como `anon`.
export async function getTodayOpenAttendance(workerId, sessionToken) {
  const { data, error } = await supabase.rpc('kiosko_get_estado', {
    p_worker_id: workerId,
    p_token: sessionToken,
    p_fecha: localDateString(),
  })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    id: row.id,
    worker_id: row.worker_id,
    project_id: row.project_id,
    fecha: row.fecha,
    entrada: row.entrada,
    salida: row.salida,
    valor_hora: row.valor_hora,
    projects: { id: row.project_id, nombre: row.proyecto_nombre, direccion: row.proyecto_direccion },
  }
}

function localOffset() {
  const off = new Date().getTimezoneOffset()
  const sign = off <= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

export async function registrarAsistenciaManual({ workerId, projectId, fecha, horaEntrada, horaSalida, valorHora, bono }) {
  const tz = localOffset()
  const entradaISO = `${fecha}T${horaEntrada}:00${tz}`
  const bonoNum = bono || 0
  let salidaISO = null
  let horasTrabajadas = null
  let costoTotal = null

  if (horaSalida) {
    salidaISO = `${fecha}T${horaSalida}:00${tz}`
    horasTrabajadas = Math.round(((new Date(salidaISO) - new Date(entradaISO)) / 3600000) * 100) / 100
    const horasBase = horasBaseJornada(fecha)
    const costoHoras = horasTrabajadas >= horasBase ? valorHora : Math.round((horasTrabajadas / horasBase) * valorHora)
    costoTotal = costoHoras + bonoNum
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
      bono: bonoNum,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Kiosco: marcar entrada. Fase 3 — pasa por RPC con el token de sesión de
// kiosco; valor_hora ya no se manda desde el cliente, la RPC lo lee de
// workers server-side.
export async function registrarEntrada(workerId, projectId, geo, sessionToken) {
  const { data, error } = await supabase.rpc('kiosko_registrar_entrada', {
    p_worker_id: workerId,
    p_token: sessionToken,
    p_project_id: projectId,
    p_fecha: localDateString(),
    p_lat: geo?.lat ?? null,
    p_lng: geo?.lng ?? null,
  })
  if (error) throw error
  return data
}

export async function actualizarTurno(attendanceId, { horaEntrada, fecha, horaSalida, valorHora, bono, projectId }) {
  const tz = localOffset()
  const entradaISO = `${fecha}T${horaEntrada}:00${tz}`
  const salidaISO = horaSalida ? `${fecha}T${horaSalida}:00${tz}` : null
  const bonoNum = bono || 0

  let horasTrabajadas = null
  let costoTotal = null
  if (salidaISO) {
    horasTrabajadas = Math.round(((new Date(salidaISO) - new Date(entradaISO)) / 3600000) * 100) / 100
    const horasBase = horasBaseJornada(fecha)
    const costoHoras = horasTrabajadas >= horasBase ? valorHora : Math.round((horasTrabajadas / horasBase) * valorHora)
    costoTotal = costoHoras + bonoNum
  }

  const { data, error } = await supabase
    .from('attendance')
    .update({
      entrada: entradaISO,
      salida: salidaISO,
      horas_trabajadas: horasTrabajadas,
      costo_total: costoTotal,
      bono: bonoNum,
      ...(projectId ? { project_id: projectId } : {}),
    })
    .eq('id', attendanceId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAttendance(attendanceId) {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId)
  if (error) throw error
}

// Kiosco: marcar salida. Fase 3 — pasa por RPC con el token de sesión de
// kiosco; horas/costo se siguen calculando en el cliente (mismo criterio
// de siempre, incluida la jornada especial de sábado) y se mandan ya
// resueltos — la RPC solo valida que el turno sea del propio trabajador.
export async function registrarSalida(workerId, attendanceId, entrada, geo, valorHora, sessionToken) {
  const now = new Date().toISOString()
  const horasTrabajadas = Math.round(((new Date(now) - new Date(entrada)) / 3600000) * 100) / 100
  const horasBase = horasBaseJornada(entrada)
  const costoTotal = horasTrabajadas >= horasBase ? valorHora : Math.round((horasTrabajadas / horasBase) * valorHora)

  const { data, error } = await supabase.rpc('kiosko_registrar_salida', {
    p_worker_id: workerId,
    p_token: sessionToken,
    p_attendance_id: attendanceId,
    p_horas_trabajadas: horasTrabajadas,
    p_costo_total: costoTotal,
    p_lat: geo?.lat ?? null,
    p_lng: geo?.lng ?? null,
  })
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
      horas_trabajadas, valor_hora, costo_total, bono,
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
  const today = localDateString()
  const { data, error } = await supabase
    .from('attendance')
    .select('*, workers(nombre, avatar), projects(nombre)')
    .eq('fecha', today)
    .order('entrada', { ascending: false })
  if (error) throw error
  return data
}

// Registros con entrada marcada pero sin salida, de días anteriores a hoy
// (el trabajador se olvidó de marcar "Me voy" y nunca volvió a marcar)
export async function getRegistrosAbiertosAnteriores() {
  const today = localDateString()
  const { data, error } = await supabase
    .from('attendance')
    .select('id, worker_id, project_id, fecha, entrada, workers(nombre, avatar), projects(nombre)')
    .is('salida', null)
    .lt('fecha', today)
    .order('fecha', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Panel /monitoreo (app_errors) ────────────────────────────────
// RLS de app_errors/app_errors_resumen ya filtra a solo admins — estas
// funciones devuelven [] silenciosamente para cualquier otro usuario
// (0 filas, no un 403), no hace falta chequear el rol acá también.
export async function getResumenErrores({ origen, desde } = {}) {
  let q = supabase.from('app_errors_resumen').select('*').order('ultima_vez', { ascending: false })
  if (origen) q = q.eq('origen', origen)
  if (desde) q = q.gte('ultima_vez', desde)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getOcurrenciasError(fingerprint, limite = 10) {
  const { data, error } = await supabase
    .from('app_errors')
    .select('id, mensaje, stack, ruta, empresa_id, rol, user_agent, online, app_version, created_at')
    .eq('fingerprint', fingerprint)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data ?? []
}

export async function getConteoErrores(desde) {
  const { count, error } = await supabase
    .from('app_errors')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', desde)
  if (error) throw error
  return count ?? 0
}

// ── Instrumentación de errores (capa de datos) ──────────────────
// Reasigna cada función exportada de arriba a una versión que loguea
// cualquier excepción (origen 'data', operacion = nombre de la función) y
// la RE-LANZA sin alterarla — el catch de cada página sigue funcionando
// exactamente igual, esto no cambia ningún comportamiento visible. No toca
// ninguna función ni ninguna página que las importa: son reasignaciones de
// la misma binding exportada, JS permite reasignar una función declarada
// con `function` y eso se refleja en quien la importó por nombre.
function withLog(nombre, fn) {
  return async function (...args) {
    try {
      return await fn.apply(this, args)
    } catch (err) {
      logError(err, { origen: 'data', operacion: nombre })
      throw err
    }
  }
}

getObras = withLog('getObras', getObras)
getObraById = withLog('getObraById', getObraById)
createObra = withLog('createObra', createObra)
updateObra = withLog('updateObra', updateObra)
deleteObra = withLog('deleteObra', deleteObra)
deleteWorker = withLog('deleteWorker', deleteWorker)
getAdditionalSales = withLog('getAdditionalSales', getAdditionalSales)
getAllAdditionalSales = withLog('getAllAdditionalSales', getAllAdditionalSales)
createAdditionalSale = withLog('createAdditionalSale', createAdditionalSale)
deleteAdditionalSale = withLog('deleteAdditionalSale', deleteAdditionalSale)
getGastos = withLog('getGastos', getGastos)
getEgresosCredito = withLog('getEgresosCredito', getEgresosCredito)
getGastosDetallado = withLog('getGastosDetallado', getGastosDetallado)
getUltimosGastos = withLog('getUltimosGastos', getUltimosGastos)
getObraMetrics = withLog('getObraMetrics', getObraMetrics)
getDashboardKPIs = withLog('getDashboardKPIs', getDashboardKPIs)
getMesesDisponibles = withLog('getMesesDisponibles', getMesesDisponibles)
getFlujoCajaMensual = withLog('getFlujoCajaMensual', getFlujoCajaMensual)
getFlujoCajaSemanal = withLog('getFlujoCajaSemanal', getFlujoCajaSemanal)
createGasto = withLog('createGasto', createGasto)
updateGasto = withLog('updateGasto', updateGasto)
deleteGasto = withLog('deleteGasto', deleteGasto)
uploadDocumento = withLog('uploadDocumento', uploadDocumento)
getDocumentos = withLog('getDocumentos', getDocumentos)
createDocumento = withLog('createDocumento', createDocumento)
deleteDocumento = withLog('deleteDocumento', deleteDocumento)
getSignedDocUrl = withLog('getSignedDocUrl', getSignedDocUrl)
getExpensasPorObraLite = withLog('getExpensasPorObraLite', getExpensasPorObraLite)
getAttendanceCostsPorObra = withLog('getAttendanceCostsPorObra', getAttendanceCostsPorObra)
getCuentasPagar = withLog('getCuentasPagar', getCuentasPagar)
getIngresos = withLog('getIngresos', getIngresos)
createIngreso = withLog('createIngreso', createIngreso)
updateIngreso = withLog('updateIngreso', updateIngreso)
deleteIngreso = withLog('deleteIngreso', deleteIngreso)
getUsuarios = withLog('getUsuarios', getUsuarios)
createUsuario = withLog('createUsuario', createUsuario)
deleteUsuario = withLog('deleteUsuario', deleteUsuario)
updateUsuarioPerfil = withLog('updateUsuarioPerfil', updateUsuarioPerfil)
updateCuentaPagar = withLog('updateCuentaPagar', updateCuentaPagar)
getCuentasCobrar = withLog('getCuentasCobrar', getCuentasCobrar)
updateCuentaCobrar = withLog('updateCuentaCobrar', updateCuentaCobrar)
getObrasActivas = withLog('getObrasActivas', getObrasActivas)
getObraByClaveActiva = withLog('getObraByClaveActiva', getObraByClaveActiva)
getWorkers = withLog('getWorkers', getWorkers)
getAllWorkers = withLog('getAllWorkers', getAllWorkers)
createWorker = withLog('createWorker', createWorker)
updateWorker = withLog('updateWorker', updateWorker)
getWorkerProjectIds = withLog('getWorkerProjectIds', getWorkerProjectIds)
toggleWorkerProject = withLog('toggleWorkerProject', toggleWorkerProject)
getWorkerObras = withLog('getWorkerObras', getWorkerObras)
getPublicWorkers = withLog('getPublicWorkers', getPublicWorkers)
verifyWorkerPin = withLog('verifyWorkerPin', verifyWorkerPin)
verifyWorkerPinSolo = withLog('verifyWorkerPinSolo', verifyWorkerPinSolo)
getActiveBanoByProject = withLog('getActiveBanoByProject', getActiveBanoByProject)
getBanosQuimicos = withLog('getBanosQuimicos', getBanosQuimicos)
createBanoQuimico = withLog('createBanoQuimico', createBanoQuimico)
updateBanoQuimico = withLog('updateBanoQuimico', updateBanoQuimico)
deleteBanoQuimico = withLog('deleteBanoQuimico', deleteBanoQuimico)
getPagosBano = withLog('getPagosBano', getPagosBano)
createPagoBano = withLog('createPagoBano', createPagoBano)
deletePagoBano = withLog('deletePagoBano', deletePagoBano)
getTareas = withLog('getTareas', getTareas)
createTarea = withLog('createTarea', createTarea)
updateTarea = withLog('updateTarea', updateTarea)
deleteTarea = withLog('deleteTarea', deleteTarea)
getProviders = withLog('getProviders', getProviders)
upsertProvider = withLog('upsertProvider', upsertProvider)
getProjectsList = withLog('getProjectsList', getProjectsList)
getAttendance = withLog('getAttendance', getAttendance)
getTodayOpenAttendance = withLog('getTodayOpenAttendance', getTodayOpenAttendance)
registrarAsistenciaManual = withLog('registrarAsistenciaManual', registrarAsistenciaManual)
registrarEntrada = withLog('registrarEntrada', registrarEntrada)
actualizarTurno = withLog('actualizarTurno', actualizarTurno)
deleteAttendance = withLog('deleteAttendance', deleteAttendance)
registrarSalida = withLog('registrarSalida', registrarSalida)
getAttendanceByProject = withLog('getAttendanceByProject', getAttendanceByProject)
getAttendanceRange = withLog('getAttendanceRange', getAttendanceRange)
getAllTodayAttendance = withLog('getAllTodayAttendance', getAllTodayAttendance)
getRegistrosAbiertosAnteriores = withLog('getRegistrosAbiertosAnteriores', getRegistrosAbiertosAnteriores)
getResumenErrores = withLog('getResumenErrores', getResumenErrores)
getOcurrenciasError = withLog('getOcurrenciasError', getOcurrenciasError)
getConteoErrores = withLog('getConteoErrores', getConteoErrores)

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
