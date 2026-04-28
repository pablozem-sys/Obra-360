import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Loader2, Delete } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPublicWorkers, verifyWorkerPin } from '../lib/supabase'

export default function AccesoTrabajador() {
  const navigate = useNavigate()
  const { loginTrabajador } = useAuth()

  const [workers, setWorkers]         = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selected, setSelected]       = useState(null)
  const [pin, setPin]                 = useState('')
  const [error, setError]             = useState('')
  const [verifying, setVerifying]     = useState(false)
  const pinRef = useRef(null)

  useEffect(() => {
    getPublicWorkers()
      .then(setWorkers)
      .catch(() => setWorkers([]))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (selected) {
      setPin('')
      setError('')
      setTimeout(() => pinRef.current?.focus(), 100)
    }
  }, [selected])

  // Verifica PIN al llegar a 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && selected) {
      handleVerify()
    }
  }, [pin])

  const handleVerify = async () => {
    setVerifying(true)
    setError('')
    try {
      const worker = await verifyWorkerPin(selected.id, pin)
      if (!worker) {
        setError('PIN incorrecto')
        setPin('')
        return
      }
      loginTrabajador(worker)
      navigate('/trabajador/asistencia')
    } catch {
      setError('Error de conexión')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  const handleDigit = (d) => {
    if (pin.length < 4) setPin(p => p + d)
  }

  const handleDelete = () => setPin(p => p.slice(0, -1))

  /* ── Step 2: PIN ─────────────────────────────────────────── */
  if (selected) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-5 relative"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="blueprint-grid absolute inset-0 pointer-events-none" />

        <div className="relative z-10 w-full max-w-xs">
          <button
            onClick={() => { setSelected(null); setError('') }}
            className="btn-ghost mb-8 -ml-2 text-sm"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeft size={14} /> Cambiar trabajador
          </button>

          {/* Worker chip */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
              style={{ background: 'var(--amber)', color: '#000', boxShadow: '0 0 16px var(--amber-glow)' }}
            >
              {selected.avatar}
            </div>
            <div>
              <p
                className="cursor-blink"
                style={{ fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.15em', color: 'var(--amber)', textTransform: 'uppercase' }}
              >
                // autenticando
              </p>
              <p className="font-semibold text-lg" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {selected.nombre}
              </p>
            </div>
          </div>

          <p className="text-sm mb-5 text-center" style={{ color: 'var(--muted)' }}>
            Ingresa tu PIN de 4 dígitos
          </p>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-all duration-150"
                style={{
                  background: i < pin.length ? 'var(--amber)' : 'var(--bg-elevated)',
                  border: `2px solid ${i < pin.length ? 'var(--amber)' : 'var(--border)'}`,
                  boxShadow: i < pin.length ? '0 0 10px var(--amber-glow)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Hidden real input (for keyboard on mobile) */}
          <input
            ref={pinRef}
            type="number"
            inputMode="numeric"
            value={pin}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              setPin(v)
              setError('')
            }}
            className="sr-only"
            aria-label="PIN"
          />

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1,2,3,4,5,6,7,8,9].map(d => (
              <button
                key={d}
                onClick={() => { handleDigit(String(d)); setError('') }}
                disabled={verifying}
                className="rounded-2xl h-16 font-display font-bold text-2xl transition-all duration-100 active:scale-95 disabled:opacity-40"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  letterSpacing: '-0.02em',
                }}
                onMouseDown={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseUp={e => e.currentTarget.style.background = 'var(--bg-card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                {d}
              </button>
            ))}
            {/* Row 4: vacío, 0, borrar */}
            <div />
            <button
              onClick={() => { handleDigit('0'); setError('') }}
              disabled={verifying}
              className="rounded-2xl h-16 font-display font-bold text-2xl transition-all duration-100 active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onMouseDown={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseUp={e => e.currentTarget.style.background = 'var(--bg-card)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={verifying || pin.length === 0}
              className="rounded-2xl h-16 flex items-center justify-center transition-all duration-100 active:scale-95 disabled:opacity-30"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {verifying
                ? <Loader2 size={20} className="animate-spin" style={{ color: 'var(--amber)' }} />
                : <Delete size={20} style={{ color: 'var(--muted)' }} />
              }
            </button>
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-center"
              style={{ fontFamily: 'DM Mono', fontSize: 11, letterSpacing: '0.08em', color: 'var(--red)' }}
            >
              ⚠ {error.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    )
  }

  /* ── Step 1: Seleccionar trabajador ─────────────────────── */
  return (
    <div
      className="min-h-screen flex flex-col px-5 py-8"
      style={{ background: 'var(--bg-base)' }}
    >
      <button
        onClick={() => navigate('/')}
        className="btn-ghost -ml-2 mb-8 text-sm self-start"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Volver
      </button>

      <div className="mb-8">
        <p
          className="font-display text-[11px] font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--muted)' }}
        >
          VAION
        </p>
        <h1
          className="font-display font-bold leading-tight"
          style={{ fontSize: 28, letterSpacing: '-0.04em', color: 'var(--text)' }}
        >
          ¿Quién eres?
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
          Selecciona tu nombre y luego ingresa tu PIN
        </p>
      </div>

      {loadingList ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay trabajadores registrados</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--subtle)' }}>El administrador debe agregarlos en Control de Asistencia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="w-full text-left rounded-2xl p-5 transition-all duration-150 active:scale-[0.98] group flex items-center gap-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                style={{ background: 'var(--amber)', color: '#000', boxShadow: '0 0 16px var(--amber-glow)' }}
              >
                {t.avatar}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base" style={{ color: 'var(--text)' }}>{t.nombre}</p>
                <p className="text-[12px]" style={{ color: 'var(--subtle)' }}>
                  Requiere PIN
                </p>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--subtle)' }} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
