import { useNavigate } from 'react-router-dom'
import { Building2, UserCheck, ShieldCheck } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Blueprint dot grid */}
      <div
        className="blueprint-grid absolute inset-0 pointer-events-none"
      />

      {/* Ambient radial glow — top center */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 420,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,149,0,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Giant VAION watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          style={{
            fontFamily: 'Unbounded, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(120px, 35vw, 280px)',
            color: 'transparent',
            WebkitTextStroke: '1px rgba(255,149,0,0.045)',
            letterSpacing: '-0.06em',
            lineHeight: 1,
            userSelect: 'none',
            marginTop: 20,
          }}
        >
          VAION
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: 'var(--amber)',
              boxShadow: '0 0 0 1px rgba(255,149,0,0.25), 0 0 50px rgba(255,149,0,0.2)',
            }}
          >
            <Building2 size={26} color="#000" strokeWidth={2.5} />
          </div>
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              letterSpacing: '0.22em',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              marginBottom: 7,
            }}
          >
            // gestión de obras
          </p>
          <h1
            style={{
              fontFamily: 'Unbounded, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(38px, 11vw, 52px)',
              letterSpacing: '-0.05em',
              lineHeight: 0.88,
              textAlign: 'center',
              color: 'var(--amber)',
              textShadow: '0 0 40px rgba(255,149,0,0.35)',
            }}
          >
            VAION
          </h1>
        </div>

        {/* Measurement tick divider */}
        <div className="flex items-center mb-8">
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, var(--border))' }} />
          {[6, 4, 14, 4, 6].map((h, i) => (
            <div
              key={i}
              style={{
                width: 1,
                height: h,
                background: i === 2 ? 'var(--amber)' : 'var(--subtle)',
                margin: '0 5px',
                flexShrink: 0,
                boxShadow: i === 2 ? '0 0 6px var(--amber)' : 'none',
              }}
            />
          ))}
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, var(--border))' }} />
        </div>

        {/* Actions */}
        <div className="space-y-3">

          {/* 01 — Trabajador (primary) */}
          <button
            onClick={() => navigate('/trabajador')}
            className="w-full text-left rounded-2xl transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'var(--amber)',
              boxShadow: '0 4px 32px rgba(255,149,0,0.22)',
              padding: '20px 22px',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 44px rgba(255,149,0,0.38)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 32px rgba(255,149,0,0.22)'}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'rgba(0,0,0,0.4)',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}>
                  01 / Operarios
                </p>
                <p style={{
                  fontFamily: 'Unbounded, sans-serif',
                  fontWeight: 800,
                  fontSize: 19,
                  letterSpacing: '-0.03em',
                  color: '#000',
                  lineHeight: 1.1,
                }}>
                  Marca tu<br />asistencia acá
                </p>
                <p style={{
                  fontFamily: 'Instrument Sans, sans-serif',
                  fontSize: 12,
                  color: 'rgba(0,0,0,0.5)',
                  marginTop: 7,
                }}>
                  Llegué · Me voy · Sin contraseña
                </p>
              </div>
              <div style={{
                width: 50, height: 50,
                background: 'rgba(0,0,0,0.1)',
                borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}>
                <UserCheck size={24} color="#000" strokeWidth={2} />
              </div>
            </div>
          </button>

          {/* 02 — Admin (secondary) */}
          <button
            onClick={() => navigate('/login')}
            className="w-full text-left rounded-2xl transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              padding: '16px 22px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--subtle)'
              e.currentTarget.style.background = 'var(--bg-elevated)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-light)'
              e.currentTarget.style.background = 'var(--bg-card)'
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'var(--subtle)',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  02 / Administración
                </p>
                <p style={{
                  fontFamily: 'Unbounded, sans-serif',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '-0.03em',
                  color: 'var(--text)',
                }}>
                  Ingreso administrativo
                </p>
                <p style={{
                  fontFamily: 'Instrument Sans, sans-serif',
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginTop: 3,
                }}>
                  ERP completo · Requiere acceso
                </p>
              </div>
              <div style={{
                width: 42, height: 42,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ShieldCheck size={19} style={{ color: 'var(--muted)' }} strokeWidth={1.5} />
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-10">
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--subtle)', letterSpacing: '0.08em' }}>
            v0.1.0 // MVP
          </p>
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'var(--subtle)', letterSpacing: '0.08em' }}>
              SISTEMA ACTIVO
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
