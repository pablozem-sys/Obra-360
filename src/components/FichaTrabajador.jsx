import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { formatCLP } from '../lib/helpers'
import { getWorkerAttendance } from '../lib/supabase'
import { hoyLocal, moverRango, rangoPara, resumirFicha } from '../lib/fichaTrabajador'

const PERIODOS = [
  { modo: 'semana', label: 'Semana' },
  { modo: 'mes', label: 'Mes' },
  { modo: '30d', label: '30 días' },
]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })
}

function hora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function etiquetaRango({ desde, hasta, modo }) {
  if (modo === 'mes') {
    const [y, m] = desde.split('-').map(Number)
    return `${MESES[m - 1]} ${y}`
  }
  const f = s => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  }
  return `${f(desde)} – ${f(hasta)}`
}

/**
 * Ficha de un trabajador para un rango de fechas: totales, desglose por obra y lista de días.
 * Bottom sheet en móvil (se cierra deslizando hacia abajo), panel lateral en escritorio.
 * Sus flechas ◀ ▶ mueven el rango de la ficha sin cerrarla.
 * Se dibuja en document.body (portal): el contenedor de la página tiene una animación con transform
 * (.page-enter) que, si no, anclaría el `position: fixed` a la página y no a la pantalla.
 */
export default function FichaTrabajador({ worker, rangoInicial, onClose }) {
  const [rango, setRango] = useState(rangoInicial)
  const [estado, setEstado] = useState({ loading: true, error: null, registros: [] })
  const [verDias, setVerDias] = useState(false)
  const [arrastre, setArrastre] = useState(0)
  const inicioY = useRef(null)
  // La distancia va también en una ref: al soltar se lee la última, aunque React no haya re-renderizado.
  const arrastreRef = useRef(0)

  useEffect(() => {
    let vigente = true
    setEstado(e => ({ ...e, loading: true, error: null }))
    getWorkerAttendance({ workerId: worker.id, desde: rango.desde, hasta: rango.hasta })
      .then(registros => vigente && setEstado({ loading: false, error: null, registros }))
      .catch(() => vigente && setEstado({ loading: false, error: 'No pudimos cargar los registros.', registros: [] }))
    return () => { vigente = false }
  }, [worker.id, rango.desde, rango.hasta])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const f = resumirFicha(estado.registros)

  // Cambiar de período toma como referencia el final del que se estaba viendo (sin pasar de hoy).
  const cambiarPeriodo = modo => {
    if (modo === rango.modo) return
    const hoy = hoyLocal()
    setRango(rangoPara(modo, rango.hasta < hoy ? rango.hasta : hoy))
  }

  // Deslizar hacia abajo para cerrar (solo desde la manilla/encabezado, en móvil).
  const onTouchStart = e => {
    inicioY.current = e.touches[0].clientY
    arrastreRef.current = 0
  }
  const onTouchMove = e => {
    if (inicioY.current == null) return
    arrastreRef.current = Math.max(0, e.touches[0].clientY - inicioY.current)
    setArrastre(arrastreRef.current)
  }
  const onTouchEnd = () => {
    const cerrar = arrastreRef.current > 90
    arrastreRef.current = 0
    inicioY.current = null
    setArrastre(0)
    if (cerrar) onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true" aria-label={`Ficha de ${worker.nombre}`}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} />

      <div
        className="relative w-full md:w-[440px] max-h-[92vh] md:max-h-none md:h-full flex flex-col rounded-t-2xl md:rounded-none overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderLeft: '1px solid var(--border)',
          transform: arrastre ? `translateY(${arrastre}px)` : undefined,
          transition: arrastre ? 'none' : 'transform 0.2s ease',
        }}
      >
        {/* Encabezado: manilla para deslizar + cerrar */}
        <div
          className="flex-shrink-0 px-4 pt-2 pb-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="md:hidden mx-auto mb-2 h-1.5 w-12 rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'var(--amber)', color: '#000' }}>
                {worker.avatar ?? '?'}
              </div>
              <div className="min-w-0">
                <h2 className="truncate" style={{ fontFamily: 'Unbounded', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{worker.nombre}</h2>
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Ficha de asistencia</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar ficha"
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 44, height: 44, border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Período de la ficha: semana, mes o últimos 30 días */}
          <div className="mt-3 grid grid-cols-3 gap-1 p-1 rounded-xl" role="group" aria-label="Período" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {PERIODOS.map(p => (
              <button
                key={p.modo}
                onClick={() => cambiarPeriodo(p.modo)}
                aria-pressed={rango.modo === p.modo}
                className="rounded-lg text-sm font-semibold"
                style={{
                  minHeight: 44,
                  background: rango.modo === p.modo ? 'var(--amber)' : 'transparent',
                  color: rango.modo === p.modo ? '#000' : 'var(--muted)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango propio de la ficha */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setRango(r => moverRango(r, -1))}
              aria-label="Período anterior"
              className="flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="inline-block text-sm font-semibold text-center first-letter:uppercase" style={{ color: 'var(--text)' }} aria-live="polite">
              {etiquetaRango(rango)}
            </span>
            <button
              onClick={() => setRango(r => moverRango(r, 1))}
              aria-label="Período siguiente"
              className="flex items-center justify-center rounded-xl"
              style={{ width: 44, height: 44, border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {estado.loading ? (
            <div className="flex items-center justify-center py-10" style={{ color: 'var(--muted)' }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : estado.error ? (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{estado.error}</p>
          ) : (
            <>
              {/* Totales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-3">
                  <p className="text-[10px] uppercase tracking-wider" style={{ fontFamily: 'Unbounded', color: 'var(--subtle)' }}>Días trabajados</p>
                  <p className="num text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>{f.dias}</p>
                  {f.turnos !== f.dias && <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{f.turnos} turnos</p>}
                </div>
                <div className="card p-3">
                  <p className="text-[10px] uppercase tracking-wider" style={{ fontFamily: 'Unbounded', color: 'var(--subtle)' }}>Total del período</p>
                  <p className="num text-2xl font-bold mt-1" style={{ color: 'var(--green)' }}>{formatCLP(f.total)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>valor día + bonos</p>
                </div>
              </div>

              {f.abiertos > 0 && (
                <div className="rounded-xl px-3 py-2 text-[13px]" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                  {f.abiertos} {f.abiertos === 1 ? 'turno abierto' : 'turnos abiertos'} (sin salida): no suman días ni total hasta que se cierren.
                </div>
              )}

              {f.turnos === 0 && f.abiertos === 0 && (
                <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Sin registros en este período.</p>
              )}

              {/* Desglose por obra */}
              {f.porObra.length > 0 && (
                <div className="card overflow-hidden">
                  <p className="px-3 pt-3 pb-2 text-[10px] uppercase tracking-wider" style={{ fontFamily: 'Unbounded', color: 'var(--subtle)' }}>Por obra</p>
                  <ul>
                    {f.porObra.map(o => (
                      <li key={o.projectId} className="px-3 py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{o.nombre}</span>
                          <span className="num text-sm font-semibold flex-shrink-0" style={{ color: 'var(--green)' }}>{formatCLP(o.total)}</span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {o.dias} {o.dias === 1 ? 'día' : 'días'}
                          {o.turnos !== o.dias && ` · ${o.turnos} turnos`}
                          {' · '}
                          {o.primera === o.ultima ? fechaCorta(o.primera) : `${fechaCorta(o.primera)} → ${fechaCorta(o.ultima)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lista de días (colapsada) */}
              {f.registros.length > 0 && (
                <div className="card overflow-hidden">
                  <button
                    onClick={() => setVerDias(v => !v)}
                    aria-expanded={verDias}
                    className="w-full flex items-center justify-between px-3"
                    style={{ minHeight: 48, color: 'var(--text)' }}
                  >
                    <span className="text-sm font-semibold">Ver días ({f.registros.length})</span>
                    <ChevronDown size={18} style={{ transform: verDias ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
                  </button>
                  {verDias && (
                    <ul>
                      {f.registros.map(r => (
                        <li
                          key={r.id}
                          className="px-3 py-2.5"
                          style={{ borderTop: '1px solid var(--border)', background: r.salida ? undefined : 'var(--amber-dim)' }}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm capitalize" style={{ color: 'var(--text)' }}>{fechaCorta(r.fecha)}</span>
                            {r.salida ? (
                              <span className="num text-sm" style={{ color: 'var(--text)' }}>{r.costo_total != null ? formatCLP(r.costo_total) : '—'}</span>
                            ) : (
                              <span className="text-[11px] font-bold" style={{ fontFamily: 'Unbounded', color: 'var(--amber)' }}>SIN SALIDA</span>
                            )}
                          </div>
                          <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                            {r.projects?.nombre ?? '—'} · {hora(r.entrada)} → {hora(r.salida)}
                            {r.valor_hora != null && ` · valor día ${formatCLP(r.valor_hora)}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
