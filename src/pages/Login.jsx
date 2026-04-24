import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ShieldCheck, Crown, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLES_MOCK = [
  {
    key: 'dueno',
    label: 'Dueño / Gerente',
    code: 'ROL_DUENO',
    desc: 'Acceso total incluyendo ingresos',
    icon: Crown,
    color: 'var(--amber)',
    colorDim: 'var(--amber-dim)',
    colorBorder: 'rgba(255,149,0,0.3)',
  },
  {
    key: 'administrativo',
    label: 'Administrativo',
    code: 'ROL_ADMIN',
    desc: 'Sin acceso a ingresos ni márgenes',
    icon: ShieldCheck,
    color: '#6B8AFF',
    colorDim: 'rgba(67,97,238,0.1)',
    colorBorder: 'rgba(67,97,238,0.3)',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const { loginAdmin } = useAuth()
  const [selected, setSelected] = useState(null)
  const [pass, setPass]         = useState('')
  const [show, setShow]         = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = () => {
    if (!selected || !pass) return
    if (pass !== '1234') { setError('CONTRASEÑA INCORRECTA'); return }
    setLoading(true)
    setTimeout(() => { loginAdmin(selected); navigate('/dashboard') }, 700)
  }

  const selectedRole = ROLES_MOCK.find(r => r.key === selected)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Blueprint dot grid */}
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
            Selecciona tu perfil y autentícate
          </p>
        </div>

        {/* Role selector */}
        <div className="space-y-2.5 mb-5">
          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 9,
            letterSpacing: '0.22em',
            color: 'var(--subtle)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Seleccionar perfil
          </p>
          {ROLES_MOCK.map(r => {
            const Icon = r.icon
            const active = selected === r.key
            return (
              <button
                key={r.key}
                onClick={() => { setSelected(r.key); setError('') }}
                className="w-full text-left rounded-2xl transition-all duration-200"
                style={{
                  background: active ? r.colorDim : 'var(--bg-card)',
                  border: `1px solid ${active ? r.colorBorder : 'var(--border)'}`,
                  padding: '16px 18px',
                  boxShadow: active ? `0 0 24px ${r.colorDim}` : 'none',
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: 11,
                    background: active ? r.colorDim : 'var(--bg-elevated)',
                    border: `1px solid ${active ? r.colorBorder : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                    <Icon size={17} style={{ color: active ? r.color : 'var(--muted)' }} strokeWidth={active ? 2 : 1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: 14, fontWeight: 600, color: active ? r.color : 'var(--text)', fontFamily: 'Instrument Sans, sans-serif', transition: 'color 0.15s' }}>
                        {r.label}
                      </p>
                      {active && (
                        <span style={{
                          fontFamily: 'DM Mono, monospace',
                          fontSize: 9,
                          letterSpacing: '0.1em',
                          color: r.color,
                          background: r.colorDim,
                          border: `1px solid ${r.colorBorder}`,
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}>
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Instrument Sans, sans-serif', marginTop: 2 }}>
                      {r.desc}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Password card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 18,
          marginBottom: 12,
        }}>
          {selectedRole && (
            <div
              className="flex items-center gap-2 mb-4 pb-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>
                PERFIL →
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: selectedRole.color, letterSpacing: '0.08em' }}>
                {selectedRole.code}
              </span>
            </div>
          )}
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

        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.06em', color: 'var(--subtle)', marginBottom: 16, paddingLeft: 2 }}>
          // demo: contraseña 1234
        </p>

        <button
          onClick={handleLogin}
          disabled={!selected || !pass || loading}
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
