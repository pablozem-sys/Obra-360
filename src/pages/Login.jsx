import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { loginAdmin } = useAuth()
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [show, setShow]     = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !pass) return
    setLoading(true)
    setError('')
    try {
      await loginAdmin(email.trim(), pass)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'CREDENCIALES INCORRECTAS'
        : 'ERROR DE AUTENTICACIÓN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="blueprint-grid absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">

        <button
          onClick={() => navigate('/')}
          className="btn-ghost mb-8 -ml-2 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>

        {/* Terminal header */}
        <div className="mb-8">
          <p
            className="cursor-blink"
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--amber)',
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            // acceso al sistema
          </p>
          <h1
            style={{
              fontFamily: 'Unbounded, sans-serif',
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
              lineHeight: 1.05,
              marginBottom: 7,
            }}
          >
            Ingreso<br />administrativo
          </h1>
          <p style={{ fontFamily: 'Instrument Sans, sans-serif', fontSize: 13, color: 'var(--muted)' }}>
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Credentials card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 18,
          marginBottom: 12,
        }}>
          <div className="mb-4">
            <label className="label">Correo electrónico</label>
            <input
              type="email"
              className="input"
              placeholder="usuario@empresa.cl"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="input pr-12"
                style={{ fontFamily: 'DM Mono, monospace', letterSpacing: pass ? '0.18em' : 'normal', fontSize: 14 }}
                placeholder="••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
              <button
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted)' }}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--red)',
            marginBottom: 10,
            paddingLeft: 2,
          }}>
            ⚠ {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={!email || !pass || loading}
          className="btn-primary w-full justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ padding: '14px', fontSize: 12, letterSpacing: '0.04em' }}
        >
          {loading
            ? <span style={{ fontFamily: 'DM Mono', letterSpacing: '0.1em' }}>AUTENTICANDO...</span>
            : <><span>Ejecutar acceso</span> <ArrowRight size={14} /></>
          }
        </button>

      </div>
    </div>
  )
}
