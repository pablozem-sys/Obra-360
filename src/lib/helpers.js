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
    .filter(g => g.obraId === obraId)
    .reduce((sum, g) => sum + g.monto, 0)
}

export function calcIngresosObra(ingresos, obraId) {
  return ingresos
    .filter(i => i.obraId === obraId)
    .reduce((sum, i) => sum + i.monto, 0)
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
  otro:        { label: 'Otro',         color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

export const ESTADOS_OBRA = {
  cotizada:     { label: 'Cotizada',      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  en_ejecucion: { label: 'En ejecución',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  pausada:      { label: 'Pausada',       color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  finalizada:   { label: 'Finalizada',    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

export const CATEGORIAS_GASTO = {
  materiales:   { label: 'Materiales',    color: '#3B82F6' },
  mano_obra:    { label: 'Mano de obra',  color: '#8B5CF6' },
  herramientas: { label: 'Herramientas',  color: '#F59E0B' },
  transporte:   { label: 'Transporte',    color: '#06B6D4' },
  arriendo:     { label: 'Arriendo',      color: '#F97316' },
  permisos:     { label: 'Permisos',      color: '#EF4444' },
  subcontratos: { label: 'Subcontratos',  color: '#EC4899' },
  otros:        { label: 'Otros',         color: '#64748B' },
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
