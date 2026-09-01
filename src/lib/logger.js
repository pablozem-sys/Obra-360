// Logger de errores de la app hacia public.app_errors (RPC log_app_error).
// Reglas duras (ver mejoras/app-errors spec): nunca lanza, nunca bloquea,
// nunca reintenta, nunca manda datos de negocio (montos, nombres, RUT, etc).
import { supabase } from './supabase'

// ── Contexto de sesión — lo setea AuthContext cuando cambia user/empresa/rol.
let ctxUserId = null
let ctxEmpresaId = null
let ctxRol = null

export function configureLogger({ empresaId, rol } = {}) {
  try {
    ctxEmpresaId = empresaId ?? null
    ctxRol = rol ?? null
  } catch { /* nunca lanza */ }
}

// ── Rate limiting en memoria (por sesión de pestaña, se resetea al recargar).
const MAX_POR_SESION = 30
const MAX_POR_FINGERPRINT = 3
let totalSesion = 0
const contadorPorFingerprint = new Map()

// ── Cola offline (memoria, no localStorage).
const MAX_COLA_OFFLINE = 20
const colaOffline = []
let listenerOnlineRegistrado = false

// ── Guarda de reentrada: un fallo logueando un error no puede loguearse a sí mismo.
let loggeando = false

// ── Whitelist de keys permitidas en `contexto` — nunca una blacklist.
// Solo IDs, nombres de operación/tabla, contadores y flags. Nada de datos
// de negocio (montos, nombres de personas, RUT, emails, teléfonos, archivos).
const CONTEXTO_KEYS_PERMITIDAS = new Set([
  'obraId', 'projectId', 'workerId', 'gastoId', 'documentId',
  'attendanceId', 'userId', 'empresaId', 'clientId',
  'count', 'intento', 'statusCode', 'httpStatus', 'tabla', 'tipo',
  'codigo', 'online', 'retry', 'origen', 'metodo',
])

function scrubContexto(contexto) {
  if (!contexto || typeof contexto !== 'object') return {}
  const limpio = {}
  for (const [k, v] of Object.entries(contexto)) {
    if (!CONTEXTO_KEYS_PERMITIDAS.has(k)) continue
    if (typeof v === 'string') limpio[k] = v.slice(0, 200)
    else if (typeof v === 'number' || typeof v === 'boolean') limpio[k] = v
    // objetos/arrays anidados se descartan — solo primitivos.
  }
  return limpio
}

// Normaliza el mensaje reemplazando valores variables (UUIDs, números,
// fechas) por placeholders, para que el mismo tipo de error agrupe bajo un
// solo fingerprint aunque el detalle cambie entre ocurrencias.
function normalizarMensaje(msg) {
  return String(msg ?? '')
    .split('\n')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/\d{4}-\d{2}-\d{2}/g, '{fecha}')
    .replace(/\d+/g, '{n}')
    .slice(0, 300)
}

// Hash corto y estable (djb2), sin dependencias.
function hashCorto(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

function calcularFingerprint(origen, operacion, mensaje) {
  const base = `${origen || ''}|${operacion || ''}|${normalizarMensaje(mensaje)}`
  return hashCorto(base)
}

async function enviar(payload) {
  try {
    await supabase.rpc('log_app_error', payload)
  } catch {
    // fire-and-forget — nunca se reintenta, nunca se vuelve a loguear.
  }
}

function flushColaOffline() {
  if (colaOffline.length === 0) return
  const pendientes = colaOffline.splice(0, colaOffline.length)
  for (const payload of pendientes) enviar(payload)
}

if (typeof window !== 'undefined' && !listenerOnlineRegistrado) {
  listenerOnlineRegistrado = true
  window.addEventListener('online', flushColaOffline)
}

/**
 * logError(error, { origen, operacion, contexto })
 * origen: 'ui' | 'data' | 'auth' | 'storage' | 'unhandled' | 'promise'
 * Nunca lanza. Fire-and-forget — no bloquea al llamador.
 */
export function logError(error, { origen = 'unhandled', operacion = null, contexto = {} } = {}) {
  try {
    if (loggeando) return
    loggeando = true

    try {
      const mensajeCrudo = error?.message || String(error ?? 'error desconocido')
      const fingerprint = calcularFingerprint(origen, operacion, mensajeCrudo)

      if (totalSesion >= MAX_POR_SESION) return
      const porFp = contadorPorFingerprint.get(fingerprint) || 0
      if (porFp >= MAX_POR_FINGERPRINT) return

      totalSesion += 1
      contadorPorFingerprint.set(fingerprint, porFp + 1)

      const payload = {
        p_fingerprint: fingerprint,
        p_mensaje: mensajeCrudo.slice(0, 500),
        p_stack: (error?.stack || null)?.slice?.(0, 4000) ?? null,
        p_origen: origen,
        p_operacion: operacion,
        p_severidad: 'error',
        p_ruta: typeof location !== 'undefined' ? location.pathname : null,
        p_empresa_id: ctxEmpresaId,
        p_rol: ctxRol,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 300) : null,
        p_online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        p_app_version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null,
        p_contexto: scrubContexto(contexto),
      }

      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      if (offline) {
        if (colaOffline.length >= MAX_COLA_OFFLINE) colaOffline.shift()
        colaOffline.push(payload)
        return
      }

      enviar(payload)
    } finally {
      loggeando = false
    }
  } catch {
    // nunca lanza, ni siquiera si algo de lo anterior falla.
  }
}
