import { useNavigate } from 'react-router-dom'
import { Building2, UserCheck, ShieldCheck } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{
        background: 'var(--bg-base)',
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,149,0,0.06) 0%, transparent 70%),
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")
        `,
      }}
    >
      {/* Brand */}
      <div className="flex flex-col items-center mb-14">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'var(--amber)', boxShadow: '0 0 40px var(--amber-glow)' }}
        >
          <Building2 size={30} color="#000" strokeWidth={2.5} />
        </div>
        <h1
          className="font-display text-center leading-tight"
          style={{ fontSize: 22, letterSpacing: '-0.04em', color: 'var(--text)' }}
        >
          CONTROL<br />
          <span style={{ color: 'var(--amber)' }}>OBRAS 360°</span>
        </h1>
      </div>

      {/* Acciones */}
      <div className="w-full max-w-sm space-y-4">
        {/* Trabajador */}
        <button
          onClick={() => navigate('/trabajador')}
          className="w-full text-left rounded-2xl p-6 transition-all duration-200 active:scale-[0.98] group"
          style={{
            background: 'var(--amber)',
            boxShadow: '0 8px 40px var(--amber-glow)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 12px 50px rgba(255,149,0,0.4)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 8px 40px var(--amber-glow)'}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-black/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCheck size={28} color="#000" strokeWidth={2} />
            </div>
            <div>
              <p className="font-display font-bold text-black" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
                Marca tu asistencia acá
              </p>
              <p className="text-black/60 text-sm mt-0.5" style={{ fontFamily: 'Instrument Sans' }}>
                Llegué · Me voy · Sin contraseña
              </p>
            </div>
          </div>
        </button>

        {/* Admin */}
        <button
          onClick={() => navigate('/login')}
          className="w-full text-left rounded-2xl p-6 transition-all duration-200 active:scale-[0.98]"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--subtle)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
            >
              <ShieldCheck size={26} style={{ color: 'var(--muted)' }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-display font-bold" style={{ fontSize: 16, letterSpacing: '-0.03em', color: 'var(--text)' }}>
                Ingreso administrativo
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'Instrument Sans' }}>
                ERP completo · Requiere acceso
              </p>
            </div>
          </div>
        </button>
      </div>

      <p className="text-[11px] mt-12" style={{ color: 'var(--subtle)', fontFamily: 'DM Mono' }}>
        v0.1.0 MVP
      </p>
    </div>
  )
}
