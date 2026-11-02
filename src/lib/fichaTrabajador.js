// Ficha de trabajador (Asistencia → Por Fecha): resumen de sus registros en un rango.
// Cálculo en cliente, con los mismos campos que suma la vista agrupada (costo_total por turno).
// Los turnos abiertos (sin salida) no suman días ni plata: se cuentan aparte.

const pad = n => String(n).padStart(2, '0')
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Resume los registros de UN trabajador.
 * - dias: días distintos con al menos un turno cerrado (dos obras el mismo día = 1 día)
 * - turnos: cantidad de turnos cerrados (puede ser mayor que dias)
 * - total: suma de costo_total de los turnos cerrados (igual que la vista agrupada)
 * - porObra: mismo cálculo por obra, con primera y última fecha trabajada
 */
export function resumirFicha(registros) {
  const cerrados = registros.filter(r => r.salida)
  const abiertos = registros.filter(r => !r.salida)

  const obras = new Map()
  for (const r of cerrados) {
    const key = r.project_id
    if (!obras.has(key)) {
      obras.set(key, { projectId: key, nombre: r.projects?.nombre ?? '—', fechas: new Set(), turnos: 0, total: 0, primera: r.fecha, ultima: r.fecha })
    }
    const o = obras.get(key)
    o.fechas.add(r.fecha)
    o.turnos += 1
    o.total += r.costo_total ?? 0
    if (r.fecha < o.primera) o.primera = r.fecha
    if (r.fecha > o.ultima) o.ultima = r.fecha
  }

  const porObra = [...obras.values()]
    .map(({ fechas, ...o }) => ({ ...o, dias: fechas.size }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))

  const dias = [...registros].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.entrada).localeCompare(String(a.entrada)))

  return {
    dias: new Set(cerrados.map(r => r.fecha)).size,
    turnos: cerrados.length,
    total: cerrados.reduce((s, r) => s + (r.costo_total ?? 0), 0),
    abiertos: abiertos.length,
    porObra,
    registros: dias,
  }
}

/** Hoy en hora local, 'yyyy-MM-dd'. */
export const hoyLocal = () => toISO(new Date())

/**
 * Rango de un período que contiene la fecha `ref`:
 * - 'semana': lunes a domingo
 * - 'mes': mes calendario
 * - '30d': los 30 días que terminan en `ref`
 */
export function rangoPara(modo, ref) {
  const d = parse(ref)
  if (modo === 'semana') {
    const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    return { desde: toISO(lunes), hasta: toISO(domingo), modo }
  }
  if (modo === '30d') {
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29)
    return { desde: toISO(inicio), hasta: ref, modo }
  }
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { desde: toISO(inicio), hasta: toISO(fin), modo: 'mes' }
}

/** El mismo período, una vez hacia atrás (-1) o adelante (+1). */
export function moverRango({ desde, hasta, modo }, dir) {
  if (modo === 'mes') {
    const d = parse(desde)
    const inicio = new Date(d.getFullYear(), d.getMonth() + dir, 1)
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0)
    return { desde: toISO(inicio), hasta: toISO(fin), modo }
  }
  const largo = Math.round((parse(hasta) - parse(desde)) / 86400000) + 1
  const shift = (s, n) => { const x = parse(s); x.setDate(x.getDate() + n); return toISO(x) }
  return { desde: shift(desde, dir * largo), hasta: shift(hasta, dir * largo), modo }
}
