export const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || 'VAION'
export const COMPANY_SLUG = import.meta.env.VITE_COMPANY_SLUG || 'va-constructora'

// Jornada base por día: sábado (08:30-15:00) = 6.5h, resto de la semana = 8h.
// Acepta 'YYYY-MM-DD' o cualquier string/Date parseable (ej. timestamp ISO de entrada).
export function horasBaseJornada(fecha) {
  const d = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? new Date(`${fecha}T00:00:00`)
    : new Date(fecha)
  return d.getDay() === 6 ? 6.5 : 8
}

export function formatCLP(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const [year, month, day] = dateStr.split('-')
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`
}

export function calcGastosObra(gastos, obraId) {
  return gastos
    .filter(g => g.project_id === obraId)
    .reduce((sum, g) => sum + (g.monto ?? 0), 0)
}

export function calcIngresosObra(ingresos, obraId) {
  return ingresos
    .filter(i => i.project_id === obraId)
    .reduce((sum, i) => sum + (i.monto ?? 0), 0)
}

export function calcManoObraObra(registros, obraId) {
  return registros
    .filter(r => r.project_id === obraId && r.costo_total != null)
    .reduce((sum, r) => sum + r.costo_total, 0)
}

export function calcGastosTotalesObra(gastos, registros, obraId) {
  return calcGastosObra(gastos, obraId) + calcManoObraObra(registros, obraId)
}

export function calcMargen(ingresos, gastos) {
  if (ingresos === 0) return 0
  return ((ingresos - gastos) / ingresos) * 100
}

export const TIPOS_OBRA = {
  piscina:     { label: 'Piscina',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  quincho:     { label: 'Quincho',      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  ampliacion:  { label: 'Ampliación',   color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  remodelacion:{ label: 'Remodelación', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  '360':       { label: '360',          color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  otro:        { label: 'Otro',         color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

export const ESTADOS_OBRA = {
  cotizada:     { label: 'Cotizada',     color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  en_ejecucion: { label: 'En ejecución', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  pausada:      { label: 'Pausada',      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  finalizada:   { label: 'Finalizada',   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

// ── Categorías de egresos ────────────────────────────────────────
export const CATEGORIAS_GASTO = {
  // Costo Directo de la Obra (CDO)
  materiales:       { label: 'Materiales',       grupo: 'Costo Directo de la Obra', color: '#3B82F6' },
  subcontratos:     { label: 'Subcontratos',     grupo: 'Costo Directo de la Obra', color: '#EC4899' },
  equipos:          { label: 'Equipos',          grupo: 'Costo Directo de la Obra', color: '#06B6D4' },
  aridos:           { label: 'Áridos',           grupo: 'Costo Directo de la Obra', color: '#A3642A' },
  retiro_escombros: { label: 'Retiro escombros', grupo: 'Costo Directo de la Obra', color: '#8B5E3C' },
  banio_quimico:    { label: 'Baño químico',     grupo: 'Costo Directo de la Obra', color: '#7C3AED' },
  flete:            { label: 'Flete',            grupo: 'Costo Directo de la Obra', color: '#0EA5E9' },
  otros_operacion:  { label: 'Otros',            grupo: 'Costo Directo de la Obra', color: '#475569' },
  // Gastos Generales (GAV)
  sueldos:          { label: 'Sueldos',          grupo: 'Gastos Generales',         color: '#F97316' },
  publicidad:       { label: 'Publicidad',       grupo: 'Gastos Generales',         color: '#F59E0B' },
  marketing:        { label: 'Marketing',        grupo: 'Gastos Generales',         color: '#EF4444' },
  bencina:          { label: 'Bencina',          grupo: 'Gastos Generales',         color: '#E879F9' },
  herramientas:     { label: 'Herramientas',     grupo: 'Gastos Generales',         color: '#34D399' },
  arriendo:         { label: 'Arriendo',         grupo: 'Gastos Generales',         color: '#60A5FA' },
  cuentas:          { label: 'Cuentas',          grupo: 'Gastos Generales',         color: '#94A3B8' },
  retiros:          { label: 'Retiros',          grupo: 'Gastos Generales',         color: '#2DD4BF' },
  otros:            { label: 'Otros',            grupo: 'Gastos Generales',         color: '#64748B' },
  mano_obra:        { label: 'Mano de obra',     grupo: 'Costo Directo de la Obra', color: '#8B5CF6' },
  // Legacy — solo para mostrar datos históricos
  transporte:       { label: 'Transporte',       grupo: 'Costo Directo de la Obra', color: '#06B6D4', legacy: true },
}

export const ESTADOS_PAGO = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  pagado:    { label: 'Pagado',    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cobrado:   { label: 'Cobrado',   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  vencido:   { label: 'Vencido',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export const TIPOS_DOC = {
  factura:    { label: 'Factura',     icon: '🧾', color: 'text-blue-400' },
  boleta:     { label: 'Boleta',      icon: '🧾', color: 'text-cyan-400' },
  cotizacion: { label: 'Cotización',  icon: '📋', color: 'text-amber-400' },
  contrato:   { label: 'Contrato',    icon: '📄', color: 'text-purple-400' },
  foto:       { label: 'Foto',        icon: '📷', color: 'text-emerald-400' },
  permiso:    { label: 'Permiso',     icon: '📑', color: 'text-red-400' },
  comprobante:{ label: 'Comprobante', icon: '✅', color: 'text-green-400' },
}

// ── Cotizador ─────────────────────────────────────────────────────
export const ESTADOS_COTIZACION = {
  borrador:  { label: 'Borrador',  color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  emitida:   { label: 'Emitida',   color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  aceptada:  { label: 'Aceptada',  color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rechazada: { label: 'Rechazada', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  expirada:  { label: 'Expirada',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

export const REGIMENES_IVA = {
  obra:  { label: 'Obra (19% × 50%)' },
  pleno: { label: 'Pleno (19%)' },
}
