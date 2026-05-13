import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Delete } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { verifyWorkerPinSolo } from '../lib/supabase'

export default function AccesoTrabajador() {
  const navigate = useNavigate()
  const { loginTrabajador } = useAuth()

  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [verifying, setVerifying] = useState(false)

  const handleDigit = (d) => {
    if (verifying || pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) handleVerify(next)
  }

  const handleDelete = () => {
    if (!verifying) setPin(p => p.slice(0, -1))
  }

  const handleVerify = async (p) => {
    setVerifying(true)
    setError('')
    try {
      const worker = await verifyWorkerPinSolo(p)
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

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="blueprint-grid absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-xs">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost mb-8 -ml-2 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>

        <p
          className="cursor-blink mb-1"
          style={{ fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.15em', color: 'var(--amber)', textTransform: 'uppercase' }}
        >
          // autenticando
        </p>
        <h2
          className="font-display font-bold mb-1"
          style={{ fontSize: 24, letterSpacing: '-0.04em', color: 'var(--text)' }}
        >
          Ingresa tu PIN
        </h2>
        <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
          Tu clave personal de 4 dígitos
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

        {/* Error */}
        {error && (
          <p
            className="text-center mb-4"
            style={{ fontFamily: 'DM Mono', fontSize: 11, letterSpacing: '0.08em', color: 'var(--red)' }}
          >
            ⚠ {error.toUpperCase()}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(String(d))}
              disabled={verifying || pin.length >= 4}
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
          <div />
          <button
            onClick={() => handleDigit('0')}
            disabled={verifying || pin.length >= 4}
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
      </div>
    </div>
  )
}
