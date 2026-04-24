import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Plus, ArrowDownCircle,
  ArrowUpCircle, BarChart3, Wallet, FolderOpen, MapPin, Settings
} from 'lucide-react'
import { currentUser } from '../../data/mockData'

const nav = [
  { to: '/',               label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/obras',          label: 'Obras',            icon: Building2 },
  { to: '/cuentas-pagar',  label: 'CxP',              icon: ArrowDownCircle },
  { to: '/cuentas-cobrar', label: 'CxC',              icon: ArrowUpCircle },
  { to: '/eerr',           label: 'EERR',             icon: BarChart3 },
  { to: '/flujo-caja',     label: 'Flujo de Caja',    icon: Wallet },
  { to: '/documentos',     label: 'Documentos',       icon: FolderOpen },
  { to: '/mapa',           label: 'Mapa',             icon: MapPin },
]

const roleBadge = {
  administrador: { label: 'Admin',      style: { background: 'rgba(255,149,0,0.12)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.25)' } },
  gerente:       { label: 'Gerente',    style: { background: 'rgba(67,97,238,0.12)', color: '#6B8AFF', border: '1px solid rgba(67,97,238,0.25)' } },
  jefe_obra:     { label: 'Jefe Obra',  style: { background: 'rgba(130,80,255,0.12)', color: '#A78BFA', border: '1px solid rgba(130,80,255,0.25)' } },
  contador:      { label: 'Contador',   style: { background: 'rgba(0,196,140,0.12)', color: 'var(--green)', border: '1px solid rgba(0,196,140,0.25)' } },
  terreno:       { label: 'Terreno',    style: { background: 'rgba(89,96,133,0.2)', color: '#8892B0', border: '1px solid rgba(89,96,133,0.3)' } },
}

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside
      className="hidden lg:flex flex-col w-60 min-h-screen fixed top-0 left-0 z-30"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--amber)', boxShadow: '0 0 20px var(--amber-glow)' }}
            >
              <Building2 size={18} color="#000" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 rounded-xl animate-shimmer" />
          </div>
          <div>
            <div className="font-display text-[11px] font-800 leading-tight" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              CONTROL
            </div>
            <div className="font-display text-[11px] font-800 leading-tight" style={{ color: 'var(--amber)', letterSpacing: '-0.02em' }}>
              OBRAS <span className="opacity-70">360°</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-4">
        <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary w-full justify-center">
          <Plus size={15} strokeWidth={2.5} />
          Subir Gasto
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                isActive ? 'text-[var(--amber)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`
            }
            style={({ isActive }) => isActive ? {
              background: 'var(--amber-dim)',
              border: '1px solid rgba(255,149,0,0.2)',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
            }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={15}
                  style={{ color: isActive ? 'var(--amber)' : 'var(--subtle)' }}
                  className="group-hover:text-[var(--muted)] transition-colors flex-shrink-0"
                />
                <span className="font-sans">{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 pb-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-[var(--bg-elevated)] group"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display text-xs font-700 text-black"
            style={{ background: 'var(--amber)', boxShadow: '0 0 12px var(--amber-glow)' }}
          >
            {currentUser.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{currentUser.nombre}</p>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={roleBadge[currentUser.rol]?.style}
            >
              {roleBadge[currentUser.rol]?.label}
            </span>
          </div>
          <Settings size={13} className="text-[var(--subtle)] group-hover:text-[var(--muted)] transition-colors" />
        </div>
      </div>
    </aside>
  )
}
