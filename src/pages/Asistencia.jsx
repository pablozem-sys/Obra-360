import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getTodayOpenAttendance,
  registrarEntrada,
  registrarSalida,
  getWorkerObras,
} from '../lib/supabase'
import { BRAND_NAME } from '../lib/helpers'

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

function getGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    const timer = setTimeout(() => resolve(null), 5000)
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { clearTimeout(timer); resolve(null) },
      { timeout: 5000, enableHighAccuracy: true }
    )
  })
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    const { road, house_number, suburb, city, town } = data.address || {}
    const calle = road ? `${road}${house_number ? ` ${house_number}` : ''}` : null
    const sector = suburb || city || town || null
    return [calle, sector].filter(Boolean).join(', ') || null
  } catch {
    return null
  }
}

export default function Asistencia() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const time = useClock()

  const [registroAbierto, setRegistroAbierto] = useState(null)
  const [step, setStep]                       = useState('main')
  const [loading, setLoading]                 = useState(false)
  const [initLoading, setInitLoading]         = useState(true)
  const [lastAction, setLastAction]           = useState(null)

  const [obras, setObras]                   = useState([])
  const [obraSeleccionada, setObraSeleccionada] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      navigate('/trabajador', { replace: true })
      return
    }
    const t = setTimeout(() => setInitLoading(false), 6000)

    Promise.all([
      getTodayOpenAttendance(user.id).catch(() => null),
      getWorkerObras(user.id).catch(() => []),
    ]).then(([registro, listaObras]) => {
      setRegistroAbierto(registro ?? null)
      setObras(listaObras)
      if (listaObras.length === 1) setObraSeleccionada(listaObras[0])
    }).finally(() => { clearTimeout(t); setInitLoading(false) })
  }, [user?.id])

  const valorHora = user?.valor_hora ?? user?.valorHora ?? 5000

  const tieneEntrada    = !!registroAbierto
  const obraActual      = registroAbierto?.projects ?? null
  const horasDesdeEntrada = registroAbierto
    ? ((time - new Date(registroAbierto.entrada)) / 3600000).toFixed(1)
    : null

  const handleLlegue = async () => {
    if (!obraSeleccionada) return
    setLoading(true)
    const geo = await getGeo()
    try {
      const [record, address] = await Promise.all([
        registrarEntrada(user.id, obraSeleccionada.id, geo, valorHora),
        geo ? reverseGeocode(geo.lat, geo.lng) : Promise.resolve(null),
      ])
      setRegistroAbierto({ ...record, projects: obraSeleccionada })
      setLastAction({ tipo: 'entrada', hora: new Date().toISOString(), obra: obraSeleccionada, address })
      setStep('confirmado')
    } catch (err) {
      console.error('registrarEntrada:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMeVoy = async () => {
    if (!tieneEntrada) return
    setLoading(true)
    const geo = await getGeo()
    let horas, costo
    try {
      const updated = await registrarSalida(registroAbierto.id, registroAbierto.entrada, geo, valorHora)
      horas = updated.horas_trabajadas
      costo = updated.costo_total
    } catch (err) {
      console.error('registrarSalida:', err)
      horas = Math.round(((new Date() - new Date(registroAbierto.entrada)) / 3600000) * 100) / 100
      costo = Math.round(horas * valorHora)
    }
    setRegistroAbierto(null)
    setLastAction({ tipo: 'salida', hora: new Date().toISOString(), horas: Number(horas).toFixed(1), costo, obra: obraActual })
    setStep('confirmado')
    setLoading(false)
  }

  const formatTime = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const formatHour = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

  /* ── Loading inicial ─────────────────────── */
  if (initLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--amber)' }} />
      </div>
    )
  }

  /* ── Confirmado ─────────────────────────── */
  if (step === 'confirmado' && lastAction) {
    const esEntrada = lastAction.tipo === 'entrada'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
          style={{
            background: esEntrada ? 'var(--green-dim)' : 'var(--red-dim)',
            border: `1px solid ${esEntrada ? 'rgba(0,196,140,0.3)' : 'rgba(255,69,96,0.3)'}`,
            boxShadow: `0 0 40px ${esEntrada ? 'var(--green-dim)' : 'var(--red-dim)'}`,
          }}
        >
          <CheckCircle2 size={44} style={{ color: esEntrada ? 'var(--green)' : 'var(--red)' }} />
        </div>

        <p className="font-display text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          {esEntrada ? 'Entrada registrada' : 'Salida registrada'}
        </p>
        <h2 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
          {esEntrada ? '¡Buen trabajo!' : '¡Hasta luego!'}
        </h2>

        <div className="mt-5 w-full max-w-xs">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="space-y-2 text-left">
              {lastAction.hora && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--muted)' }}>Hora</span>
                  <span className="num font-medium" style={{ color: 'var(--text)' }}>{formatHour(lastAction.hora)}</span>
                </div>
              )}
              {lastAction.obra && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--muted)' }}>Obra</span>
                  <span className="font-medium text-right max-w-[60%]" style={{ color: 'var(--text)' }}>{lastAction.obra.nombre}</span>
                </div>
              )}
              {lastAction.address && (
                <div className="flex justify-between text-sm gap-3">
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>Ubicación</span>
                  <span className="text-right text-xs" style={{ color: 'var(--muted)' }}>{lastAction.address}</span>
                </div>
              )}
              {!esEntrada && lastAction.horas && (
                <>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted)' }}>Horas trabajadas</span>
                    <span className="num font-bold" style={{ color: 'var(--amber)' }}>{lastAction.horas} hrs</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted)' }}>Costo registrado</span>
                    <span className="num font-bold" style={{ color: 'var(--green)' }}>
                      ${Number(lastAction.costo).toLocaleString('es-CL')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8 w-full max-w-xs">
          <button
            onClick={() => { setStep('main'); setLastAction(null) }}
            className="btn-primary flex-1 justify-center"
          >
            Volver
          </button>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="btn-secondary flex-1 justify-center"
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  /* ── Main ────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col px-5 py-8" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-display text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {BRAND_NAME}
          </p>
          <p className="font-semibold text-lg mt-0.5" style={{ color: 'var(--text)' }}>{user?.nombre}</p>
        </div>
        <button
          onClick={() => { logout(); navigate('/') }}
          className="btn-ghost text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <LogOut size={15} /> Salir
        </button>
      </div>

      {/* Clock */}
      <div className="text-center mb-8">
        <p className="num font-medium" style={{ fontSize: 52, letterSpacing: '-0.04em', color: 'var(--text)', fontFamily: 'DM Mono' }}>
          {formatTime(time)}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {time.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Si ya tiene entrada → mostrar estado y ME VOY */}
      {tieneEntrada && obraActual ? (
        <>
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'var(--green-dim)', border: '1px solid rgba(0,196,140,0.25)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
              <span className="text-[12px] font-semibold" style={{ color: 'var(--green)', fontFamily: 'Unbounded' }}>
                EN OBRA
              </span>
            </div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{obraActual.nombre}</p>
            <div className="flex items-center gap-4 mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
              <span className="flex items-center gap-1">
                <Clock size={11} /> Desde {formatHour(registroAbierto.entrada)}
              </span>
              <span className="num font-medium" style={{ color: 'var(--amber)' }}>
                {horasDesdeEntrada} hrs acumuladas
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <button
              onClick={handleMeVoy}
              disabled={loading}
              className="w-full rounded-3xl transition-all duration-200 active:scale-[0.97] disabled:opacity-60"
              style={{ background: 'var(--red)', padding: '32px 24px', boxShadow: '0 8px 40px rgba(255,69,96,0.35)' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 50px rgba(255,69,96,0.5)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 8px 40px rgba(255,69,96,0.35)'}
            >
              {loading
                ? <Loader2 size={36} className="mx-auto animate-spin" color="#fff" />
                : <>
                    <p className="font-display font-black text-white text-center" style={{ fontSize: 32, letterSpacing: '-0.04em' }}>ME VOY</p>
                    <p className="text-white/60 text-sm text-center mt-1" style={{ fontFamily: 'Instrument Sans' }}>Registrar salida</p>
                  </>
              }
            </button>
          </div>
        </>
      ) : (
        /* Sin entrada → seleccionar obra y LLEGUÉ */
        <>
          <div className="mb-4">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
              ¿En qué obra estás?
            </p>
            {obras.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay obras disponibles</p>
            ) : (
              <div className="space-y-2">
                {obras.map(obra => {
                  const selected = obraSeleccionada?.id === obra.id
                  return (
                    <button
                      key={obra.id}
                      onClick={() => setObraSeleccionada(obra)}
                      className="w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.98]"
                      style={{
                        background: selected ? 'var(--amber)' : 'var(--bg-card)',
                        border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
                        boxShadow: selected ? '0 0 20px var(--amber-glow)' : 'none',
                      }}
                    >
                      <p
                        className="font-semibold text-sm"
                        style={{ color: selected ? '#000' : 'var(--text)' }}
                      >
                        {obra.nombre}
                      </p>
                      {obra.direccion && (
                        <p
                          className="text-[12px] mt-0.5"
                          style={{ color: selected ? 'rgba(0,0,0,0.6)' : 'var(--muted)' }}
                        >
                          {obra.direccion}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-end">
            <button
              onClick={handleLlegue}
              disabled={loading || !obraSeleccionada}
              className="w-full rounded-3xl transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
              style={{ background: 'var(--green)', padding: '32px 24px', boxShadow: obraSeleccionada ? '0 8px 40px rgba(0,196,140,0.35)' : 'none' }}
              onMouseEnter={e => { if (obraSeleccionada) e.currentTarget.style.boxShadow = '0 12px 50px rgba(0,196,140,0.5)' }}
              onMouseLeave={e => { if (obraSeleccionada) e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,196,140,0.35)' }}
            >
              {loading
                ? <Loader2 size={36} className="mx-auto animate-spin" color="#000" />
                : <>
                    <p className="font-display font-black text-black text-center" style={{ fontSize: 32, letterSpacing: '-0.04em' }}>LLEGUÉ</p>
                    <p className="text-black/60 text-sm text-center mt-1" style={{ fontFamily: 'Instrument Sans' }}>Registrar entrada</p>
                  </>
              }
            </button>
          </div>
        </>
      )}

    </div>
  )
}
