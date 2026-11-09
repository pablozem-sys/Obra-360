// Geolocalización de asistencia: cruce entre el punto donde marcó el
// trabajador y la ubicación de la obra (projects.lat/lng).

// Radio para considerar que marcó "en la obra". El GPS del celular dentro
// de una construcción suele errar 50–150 m, por eso no es más estricto.
export const RADIO_OBRA_M = 300

export function distanciaM(a, b) {
  const R = 6371000
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const num = v => (v == null || v === '' ? null : Number(v))

/**
 * Estado de un marcaje respecto de la obra:
 *  - 'ok'        marcó dentro del radio
 *  - 'lejos'     marcó fuera del radio (distancia en metros)
 *  - 'sin_gps'   no activó la ubicación
 *  - 'sin_obra'  la obra no tiene ubicación cargada (no se puede comparar)
 */
export function estadoUbicacion(lat, lng, obra) {
  const p = { lat: num(lat), lng: num(lng) }
  if (p.lat == null || p.lng == null) return { estado: 'sin_gps' }
  const o = { lat: num(obra?.lat), lng: num(obra?.lng) }
  if (o.lat == null || o.lng == null) return { estado: 'sin_obra' }
  const distancia = distanciaM(p, o)
  return { estado: distancia <= RADIO_OBRA_M ? 'ok' : 'lejos', distancia }
}

export function formatDistancia(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`
}

/** Dirección → coordenadas (OpenStreetMap). Devuelve null si no la encuentra. */
export async function geocodificarDireccion(direccion) {
  const q = direccion?.trim()
  if (!q) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
    if (!res.ok) return null
    const [hit] = await res.json()
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null
  } catch {
    return null
  }
}

/** Ubicación actual del dispositivo (para fijar la obra estando en terreno). */
export function ubicacionActual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Este dispositivo no permite ubicación')); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('No se pudo obtener la ubicación. Revisa el permiso del navegador.')),
      { timeout: 10000, enableHighAccuracy: true }
    )
  })
}

/**
 * Link de Google Maps o coordenadas pegadas → { lat, lng }.
 * Acepta el link largo (/maps/place/...!3d..!4d.., /@lat,lng, ?q=lat,lng)
 * y el texto "-33.45, -70.66" que copia Google Maps al tocar un punto.
 * Devuelve { error } si no hay coordenadas (p. ej. el link corto
 * maps.app.goo.gl, que el navegador no puede abrir por dentro).
 */
export function coordsDesdeTexto(texto) {
  let t = (texto ?? '').trim()
  try { t = decodeURIComponent(t) } catch { /* % suelto: se usa tal cual */ }
  if (!t) return { error: 'Pega el link o las coordenadas' }
  const n = '(-?\\d{1,3}\\.\\d+)'
  const patrones = [
    new RegExp(`!3d${n}!4d${n}`), // el pin del lugar (más exacto que el centro de la vista)
    new RegExp(`[?&](?:q|query|ll|destination|center)=${n},\\s*${n}`),
    new RegExp(`@${n},${n}`),
    new RegExp(`^${n}\\s*,\\s*${n}$`),
  ]
  for (const re of patrones) {
    const m = t.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    // Chile continental e insular; descarta coordenadas invertidas o de otro país
    if (lat < -56 || lat > -17 || lng < -110 || lng > -66) {
      return { error: 'Esas coordenadas no están en Chile. Revisa el link.' }
    }
    return { lat, lng }
  }
  if (/goo\.gl|maps\.app/.test(t)) {
    return { error: 'Ese es un link corto. Ábrelo y copia la dirección completa de la barra, o toca la obra en Google Maps y copia las coordenadas (-33.45, -70.66).' }
  }
  return { error: 'No encontré coordenadas en ese texto. Pega el link de Google Maps de la obra o sus coordenadas.' }
}
