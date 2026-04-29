import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, MapPin, Clock, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getTodayOpenAttendance,
  registrarEntrada,
  registrarSalida,
  getWorkerObras,
} from '../lib/supabase'

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

function getGeo() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS no disponible en este dispositivo'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      err => reject(err),
      { timeout: 8000, enableHighAccuracy: true }
    )
  })
}

export default function Asistencia() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const time = useClock()

  const [registroAbierto, setRegistroAbierto] = useState(null)
  const [obras, setObras]                     = useState([])
  const [step, setStep]                       = useState('main')
  const [loading, setLoading]                 = useState(false)
  const [initLoading, setInitLoading]         = useState(true)
  const [lastAction, setLastAction]           = useState(null)
  const [selectedObra, setSelectedObra]       = useState(null)
  const [geoError, setGeoError]               = useState(false)

  useEffect(() => {
    if (!user?.id) return
    const t = setTimeout(() => setInitLoading(false), 6000)
    Promise.all([
      getTodayOpenAttendance(user.id).catch(() => null),
      getWorkerObras(user.id).catch(() => []),
    ]).then(([registro, obrasData]) => {
      setRegistroAbierto(registro ?? null)
      setObras(obrasData)
    }).finally(() => { clearTimeout(t); setInitLoading(false) })
  }, [user?.id])

  const valorHora = user?.valor_hora ?? user?.valorHora ?? 5000

  const tieneEntrada = !!registroAbierto
  const obraActual   = registroAbierto
    ? obras.find(o => o.id === registroAbierto.project_id)
    : null
  const horasDesdeEntrada = registroAbierto
    ? ((time - new Date(registroAbierto.entrada)) / 3600000).toFixed(1)
    : null

  const handleLlegue = async () => {
    setGeoError(false)
    setLoading(true)
    let geo
    try {
      geo = await getGeo()
    } catch {
      setLoading(false)
      setGeoError(true)
      return
    }
    setLoading(false)
    setStep('select-obra')
    setLastAction({ tipo: 'entrada', geo })
  }

  const handleConfirmarObra = async () => {
    if (!selectedObra || !lastAction) return
    setLoading(true)
    const obra = obras.find(o => o.id === selectedObra)
    try {
      const record = await registrarEntrada(user.id, selectedObra, lastAction.geo, valorHora)
      setRegistroAbierto(record)
    } catch (err) {
      console.error('registrarEntrada:', err)
    }
    setLastAction({ tipo: 'entrada', hora: new Date().toISOString(), obra })
    setStep('confirmado')
    setLoading(false)
  }

  const handleMeVoy = async () => {
    if (!tieneEntrada) return
    setGeoError(false)
    setLoading(true)
    let geo
    try {
      geo = await getGeo()
    } catch {
      setLoading(false)
      setGeoError(true)
      return
    }
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

  const formatTime = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatHour = (iso) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

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
            onClick={() => { setStep('main'); setLastAction(null); setSelectedObra(null) }}
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

  /* ── Seleccionar obra ────────────────────── */
  if (step === 'select-obra') {
    return (
      <div className="min-h-screen flex flex-col px-5 py-8" style={{ background: 'var(--bg-base)' }}>
        <button onClick={() => setStep('main')} className="btn-ghost -ml-2 mb-8 text-sm self-start" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Atrás
        </button>
        <h2 className="font-display font-bold mb-2" style={{ fontSize: 24, letterSpacing: '-0.04em', color: 'var(--text)' }}>
          ¿En qué obra estás?
        </h2>
        <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>Selecciona la obra donde trabajarás hoy</p>

        {obras.length === 0 ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--subtle)' }}>No hay obras activas</p>
        ) : (
          <div className="space-y-3">
            {obras.map(o => {
              const active = selectedObra === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedObra(o.id)}
                  className="w-full text-left rounded-2xl p-5 transition-all duration-150 active:scale-[0.98]"
                  style={{
                    background: active ? 'var(--amber-dim)' : 'var(--bg-card)',
                    border: `1px solid ${active ? 'rgba(255,149,0,0.35)' : 'var(--border)'}`,
                  }}
                >
                  <p className="font-semibold text-base" style={{ color: active ? 'var(--amber)' : 'var(--text)' }}>{o.nombre}</p>
                  {o.direccion && <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{o.direccion}</p>}
                </button>
              )
            })}
          </div>
        )}

        <button
          onClick={handleConfirmarObra}
          disabled={!selectedObra || loading}
          className="btn-primary w-full justify-center mt-6 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ padding: '15px', fontSize: 14 }}
        >
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : <><CheckCircle2 size={18} /> Confirmar entrada</>
          }
        </button>
      </div>
    )
  }

  /* ── Main ────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col px-5 py-8" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="font-display text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            VAION
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
      <div className="text-center mb-10">
        <p className="num font-medium" style={{ fontSize: 52, letterSpacing: '-0.04em', color: 'var(--text)', fontFamily: 'DM Mono' }}>
          {formatTime(time)}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {time.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Status */}
      {tieneEntrada && obraActual && (
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
      )}

      {/* Error GPS */}
      {geoError && (
        <div
          className="rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,69,96,0.3)' }}
        >
          <MapPin size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--red)' }}>Activa tu ubicación para continuar</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
              Ve a Ajustes → Privacidad → Ubicación y permite el acceso al navegador.
            </p>
            <button
              onClick={tieneEntrada ? handleMeVoy : handleLlegue}
              className="mt-2 text-[12px] font-semibold underline underline-offset-2"
              style={{ color: 'var(--red)' }}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="space-y-4 flex-1 flex flex-col justify-center">
        {!tieneEntrada ? (
          <button
            onClick={handleLlegue}
            disabled={loading}
            className="w-full rounded-3xl transition-all duration-200 active:scale-[0.97] disabled:opacity-60"
            style={{ background: 'var(--green)', padding: '32px 24px', boxShadow: '0 8px 40px rgba(0,196,140,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 50px rgba(0,196,140,0.5)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,196,140,0.35)'}
          >
            {loading
              ? <Loader2 size={36} className="mx-auto animate-spin" color="#000" />
              : <>
                  <p className="font-display font-black text-black text-center" style={{ fontSize: 32, letterSpacing: '-0.04em' }}>LLEGUÉ</p>
                  <p className="text-black/60 text-sm text-center mt-1" style={{ fontFamily: 'Instrument Sans' }}>Registrar entrada</p>
                </>
            }
          </button>
        ) : (
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
        )}
      </div>

      {/* Geo */}
      <div className="flex items-center justify-center gap-2 mt-8" style={{ color: 'var(--subtle)' }}>
        <MapPin size={12} />
        <span className="text-[11px]" style={{ fontFamily: 'DM Mono' }}>Ubicación GPS activa</span>
      </div>
    </div>
  )
}
