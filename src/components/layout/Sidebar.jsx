import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Plus, ArrowDownCircle,
  ArrowUpCircle, BarChart3, Wallet, FolderOpen, MapPin,
  Settings, Users, LogOut
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navAll = [
  { to: '/dashboard',          label: 'Dashboard',       icon: LayoutDashboard, perm: null },
  { to: '/obras',              label: 'Obras',            icon: Building2,       perm: null },
  { to: '/asistencia-control', label: 'Asistencia',       icon: Users,           perm: null },
  { to: '/cuentas-pagar',      label: 'CxP',              icon: ArrowDownCircle, perm: null },
  { to: '/cuentas-cobrar',     label: 'CxC',              icon: ArrowUpCircle,   perm: 'verCxC' },
  { to: '/eerr',               label: 'EERR',             icon: BarChart3,       perm: 'verEERR' },
  { to: '/flujo-caja',         label: 'Flujo de Caja',    icon: Wallet,          perm: 'verFlujoCaja' },
  { to: '/documentos',         label: 'Documentos',       icon: FolderOpen,      perm: null },
  { to: '/mapa',               label: 'Mapa',             icon: MapPin,          perm: null },
]

const roleBadge = {
  dueno:         { label: 'Dueño',    style: { background: 'rgba(255,149,0,0.12)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.25)' } },
  administrativo:{ label: 'Admin',    style: { background: 'rgba(67,97,238,0.12)', color: '#6B8AFF',      border: '1px solid rgba(67,97,238,0.25)' } },
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, can, logout } = useAuth()

  const visibleNav = navAll.filter(item => !item.perm || can(item.perm))

  return (
    <aside
      className="hidden lg:flex flex-col w-60 min-h-screen fixed top-0 left-0 z-30"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--amber)', boxShadow: '0 0 20px var(--amber-glow)' }}
          >
            <Building2 size={18} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-[11px] font-bold leading-tight" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              CONTROL
            </div>
            <div className="font-display text-[11px] font-bold leading-tight" style={{ color: 'var(--amber)', letterSpacing: '-0.02em' }}>
              OBRAS <span style={{ opacity: 0.7 }}>360°</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 py-4">
        <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary w-full justify-center">
          <Plus size={15} strokeWidth={2.5} /> Subir Gasto
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group`
            }
            style={({ isActive }) => isActive ? {
              background: 'var(--amber-dim)',
              border: '1px solid rgba(255,149,0,0.2)',
              color: 'var(--amber)',
            } : {
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--muted)',
            }}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} style={{ color: isActive ? 'var(--amber)' : 'var(--subtle)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Instrument Sans' }}>{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-4 pb-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 p-3 rounded-xl group"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display text-xs font-bold text-black"
            style={{ background: 'var(--amber)', boxShadow: '0 0 12px var(--amber-glow)' }}
          >
            {user?.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{user?.nombre}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={roleBadge[user?.rol]?.style}>
              {roleBadge[user?.rol]?.label}
            </span>
          </div>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="transition-colors p-1 rounded-lg"
            style={{ color: 'var(--subtle)' }}
            title="Cerrar sesión"
            onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
