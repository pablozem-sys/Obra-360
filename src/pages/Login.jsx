import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Eye, EyeOff, ShieldCheck, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLES_MOCK = [
  {
    key: 'dueno',
    label: 'Dueño / Gerente',
    desc: 'Acceso total incluyendo ingresos',
    icon: Crown,
    color: 'var(--amber)',
    colorDim: 'var(--amber-dim)',
    colorBorder: 'rgba(255,149,0,0.3)',
  },
  {
    key: 'administrativo',
    label: 'Administrativo',
    desc: 'Sin acceso a ingresos ni márgenes',
    icon: ShieldCheck,
    color: '#4361EE',
    colorDim: 'var(--blue-dim)',
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

  const handleLogin = () => {
    if (!selected) return
    if (pass !== '1234') { setError('Contraseña incorrecta'); return }
    loginAdmin(selected)
    navigate('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost mb-8 -ml-2 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={14} /> Volver
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--amber)', boxShadow: '0 0 20px var(--amber-glow)' }}
          >
            <Building2 size={18} color="#000" />
          </div>
          <div>
            <h1 className="font-display font-bold text-[18px]" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
              Ingreso administrativo
            </h1>
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Selecciona tu perfil de acceso</p>
          </div>
        </div>

        {/* Role selector */}
        <div className="space-y-3 mb-5">
          {ROLES_MOCK.map(r => {
            const Icon = r.icon
            const active = selected === r.key
            return (
              <button
                key={r.key}
                onClick={() => { setSelected(r.key); setError('') }}
                className="w-full text-left rounded-2xl p-4 transition-all duration-150"
                style={{
                  background: active ? r.colorDim : 'var(--bg-card)',
                  border: `1px solid ${active ? r.colorBorder : 'var(--border)'}`,
                  boxShadow: active ? `0 0 20px ${r.colorDim}` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? r.colorDim : 'var(--bg-elevated)', border: `1px solid ${active ? r.colorBorder : 'var(--border)'}` }}
                  >
                    <Icon size={18} style={{ color: active ? r.color : 'var(--muted)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: active ? r.color : 'var(--text)' }}>{r.label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{r.desc}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Password */}
        <div className="mb-2">
          <label className="label">Contraseña</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="input pr-12"
              placeholder="Ingresa tu contraseña"
              value={pass}
              onChange={e => { setPass(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[12px] mb-4" style={{ color: 'var(--red)' }}>{error}</p>
        )}

        <p className="text-[11px] mb-5" style={{ color: 'var(--subtle)', fontFamily: 'DM Mono' }}>
          Demo: contraseña es 1234
        </p>

        <button
          onClick={handleLogin}
          disabled={!selected || !pass}
          className="btn-primary w-full justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ padding: '14px', fontSize: 13 }}
        >
          Entrar al sistema
        </button>
      </div>
    </div>
  )
}
