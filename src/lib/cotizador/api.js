import { supabase } from '../supabase'

let currentEmpresaId = null

export function setCotizadorEmpresaId(id) {
  currentEmpresaId = id
}

// ── Config (IVA por tenant) ──────────────────────────────────────
export async function getCotizadorConfig() {
  const { data, error } = await supabase
    .from('cotizador_config')
    .select('*')
    .eq('empresa_id', currentEmpresaId)
    .maybeSingle()
  if (error) throw error
  return data ?? { empresa_id: currentEmpresaId, iva_pct: 19, iva_obra_factor: 0.5, umbral_desvio_precio_pct: 15 }
}

// ── Catálogo ──────────────────────────────────────────────────────
export async function getCatalogo() {
  const { data, error } = await supabase
    .from('partida_catalogo')
    .select('*')
    .eq('empresa_id', currentEmpresaId)
    .eq('activa', true)
    .order('descripcion')
  if (error) throw error
  return data ?? []
}

export async function createPartidaCatalogo(partida) {
  const { data, error } = await supabase
    .from('partida_catalogo')
    .insert([{ ...partida, empresa_id: currentEmpresaId }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Histórico de precios de una partida en obras anteriores (spec sección 4 regla 4)
export async function getHistorialPrecio(partidaId) {
  const { data, error } = await supabase
    .from('historial_precio')
    .select('*, cotizacion:cotizacion_id(nombre_obra, fecha)')
    .eq('partida_id', partidaId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function registrarHistorialPrecio({ partidaId, cotizacionId, precio, usuario, motivo }) {
  const { error } = await supabase
    .from('historial_precio')
    .insert([{ partida_id: partidaId, cotizacion_id: cotizacionId ?? null, precio, usuario, motivo: motivo || null }])
  if (error) throw error
}

// ── Cotización ────────────────────────────────────────────────────
export async function getCotizaciones() {
  const { data, error } = await supabase
    .from('cotizacion')
    .select('*')
    .eq('empresa_id', currentEmpresaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createCotizacion(cotizacion) {
  const { data, error } = await supabase
    .from('cotizacion')
    .insert([{ ...cotizacion, empresa_id: currentEmpresaId }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCotizacion(id, updates) {
  const { data, error } = await supabase.from('cotizacion').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Versionamiento (sección 10) ────────────────────────────────────
export async function getVersiones(cotizacionId) {
  const { data, error } = await supabase
    .from('cotizacion_version')
    .select('*')
    .eq('cotizacion_id', cotizacionId)
    .order('numero', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Congela una versión inmutable (snapshot completo) y avanza el estado de la
// cotización — la emisión en sí no bloquea seguir editando después.
export async function emitirVersion({ cotizacionId, numero, autor, snapshot }) {
  const { data, error } = await supabase
    .from('cotizacion_version')
    .insert([{ cotizacion_id: cotizacionId, numero, autor, snapshot }])
    .select()
    .single()
  if (error) throw error
  await updateCotizacion(cotizacionId, { version_actual: numero, estado: 'emitida' })
  return data
}

// Solo una versión puede quedar marcada como aceptada por el cliente.
export async function marcarVersionAceptada(cotizacionId, versionId) {
  const { error: err1 } = await supabase
    .from('cotizacion_version')
    .update({ aceptada: false })
    .eq('cotizacion_id', cotizacionId)
  if (err1) throw err1
  const { error: err2 } = await supabase
    .from('cotizacion_version')
    .update({ aceptada: true })
    .eq('id', versionId)
  if (err2) throw err2
  await updateCotizacion(cotizacionId, { estado: 'aceptada' })
}

// Cotización completa: capítulos → sub-bloques → líneas, y paquetes → hitos, ordenados
export async function getCotizacionCompleta(id) {
  const { data, error } = await supabase
    .from('cotizacion')
    .select(`
      *,
      capitulo (
        *,
        sub_bloque (
          *,
          linea (*)
        )
      ),
      paquete_comercial (
        *,
        paquete_capitulo (*),
        hito_pago (*)
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error

  const capitulos = (data.capitulo ?? [])
    .sort((a, b) => a.orden - b.orden)
    .map((cap) => ({
      ...cap,
      sub_bloque: (cap.sub_bloque ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((sb) => ({
          ...sb,
          linea: (sb.linea ?? []).sort((a, b) => a.orden - b.orden),
        })),
    }))

  const paquetes = (data.paquete_comercial ?? [])
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({
      ...p,
      paquete_capitulo: p.paquete_capitulo ?? [],
      hito_pago: (p.hito_pago ?? []).sort((a, b) => a.orden - b.orden),
    }))

  return { ...data, capitulo: capitulos, paquete_comercial: paquetes }
}

// ── Capítulo ──────────────────────────────────────────────────────
export async function createCapitulo(capitulo) {
  const { data, error } = await supabase.from('capitulo').insert([capitulo]).select().single()
  if (error) throw error
  return data
}

export async function updateCapitulo(id, updates) {
  const { data, error } = await supabase.from('capitulo').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCapitulo(id) {
  const { error } = await supabase.from('capitulo').delete().eq('id', id)
  if (error) throw error
}

// ── Sub-bloque ────────────────────────────────────────────────────
export async function createSubBloque(subBloque) {
  const { data, error } = await supabase.from('sub_bloque').insert([subBloque]).select().single()
  if (error) throw error
  return data
}

export async function updateSubBloque(id, updates) {
  const { data, error } = await supabase.from('sub_bloque').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSubBloque(id) {
  const { error } = await supabase.from('sub_bloque').delete().eq('id', id)
  if (error) throw error
}

// ── Línea ─────────────────────────────────────────────────────────
export async function createLinea(linea) {
  const { data, error } = await supabase.from('linea').insert([linea]).select().single()
  if (error) throw error
  return data
}

export async function updateLinea(id, updates) {
  const { data, error } = await supabase.from('linea').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLinea(id) {
  const { error } = await supabase.from('linea').delete().eq('id', id)
  if (error) throw error
}

// ── Paquete comercial ────────────────────────────────────────────
export async function createPaquete(paquete) {
  const { data, error } = await supabase.from('paquete_comercial').insert([paquete]).select().single()
  if (error) throw error
  return data
}

export async function updatePaquete(id, updates) {
  const { data, error } = await supabase.from('paquete_comercial').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePaquete(id) {
  const { error } = await supabase.from('paquete_comercial').delete().eq('id', id)
  if (error) throw error
}

// ── Paquete ↔ capítulo/sub-bloque ─────────────────────────────────
export async function addDestinoPaquete({ paqueteId, capituloId, subBloqueId }) {
  const { data, error } = await supabase
    .from('paquete_capitulo')
    .insert([{ paquete_id: paqueteId, capitulo_id: capituloId ?? null, sub_bloque_id: subBloqueId ?? null }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeDestinoPaquete(id) {
  const { error } = await supabase.from('paquete_capitulo').delete().eq('id', id)
  if (error) throw error
}

// ── Hito de pago ──────────────────────────────────────────────────
export async function createHito(hito) {
  const { data, error } = await supabase.from('hito_pago').insert([hito]).select().single()
  if (error) throw error
  return data
}

export async function updateHito(id, updates) {
  const { data, error } = await supabase.from('hito_pago').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteHito(id) {
  const { error } = await supabase.from('hito_pago').delete().eq('id', id)
  if (error) throw error
}
