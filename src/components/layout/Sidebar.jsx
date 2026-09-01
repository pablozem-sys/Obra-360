import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Plus, ArrowDownCircle,
  BarChart3, Wallet, FolderOpen, Receipt,
  Users, UserCog, LogOut, Sun, Moon, Droplets, ClipboardList, FileText, ShieldAlert
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { getConteoErrores, MONITOREO_LAST_SEEN_KEY } from '../../lib/supabase'
import { IS_VAION } from '../../lib/helpers'

const navAll = [
  { to: '/dashboard',          label: 'Dashboard',       icon: LayoutDashboard, perm: null },
  { to: '/obras',              label: 'Obras',            icon: Building2,       perm: null },
  { to: '/cotizador',          label: 'Cotizador',        icon: FileText,        perm: null },
  { to: '/asistencia-control', label: 'Asistencia',       icon: Users,           perm: null },
  { to: '/cuentas-pagar',      label: 'CxP',              icon: ArrowDownCircle, perm: null },
  { to: '/eerr',               label: 'EERR',             icon: BarChart3,       perm: 'verEERR' },
  { to: '/flujo-caja',         label: 'Flujo de Caja',    icon: Wallet,          perm: 'verFlujoCaja' },
  { to: '/gastos',             label: 'Egresos',          icon: Receipt,         perm: null },
  { to: '/documentos',        label: 'Biblioteca',       icon: FolderOpen,      perm: null },
  { to: '/banos-quimicos',   label: 'Baños Químicos',   icon: Droplets,        perm: null },
  { to: '/gestion',           label: 'Gestión',          icon: ClipboardList,   perm: null },
  { to: '/usuarios',          label: 'Usuarios',         icon: UserCog,         perm: 'editarTodo' },
]

// Aparte de navAll porque no es un permiso por rol/empresa — es la
// allowlist de ADMIN_EMAILS (app_errors es de plataforma, no de tenant).
const monitoreoItem = { to: '/monitoreo', label: 'Monitoreo', icon: ShieldAlert, perm: null }

const roleBadge = {
  dueno:         { label: 'Dueño',    style: { background: 'rgba(255,149,0,0.12)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.25)' } },
  administrativo:{ label: 'Admin',    style: { background: 'rgba(67,97,238,0.12)', color: '#6B8AFF',      border: '1px solid rgba(67,97,238,0.25)' } },
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, can, logout, empresa, isAdmin } = useAuth()
  const { theme, toggle } = useTheme()
  const [errorCount, setErrorCount] = useState(0)

  // Badge de errores nuevos junto a "Monitoreo" — se refresca en cada
  // navegación (no en tiempo real). "Nuevo" = desde la última vez que Pedro
  // entró a /monitoreo (localStorage, por dispositivo/navegador).
  useEffect(() => {
    if (!isAdmin || !IS_VAION) return
    const lastSeen = localStorage.getItem(MONITOREO_LAST_SEEN_KEY)
      || new Date(Date.now() - 24 * 3600000).toISOString()
    getConteoErrores(lastSeen).then(setErrorCount).catch(() => {})
  }, [isAdmin, location.pathname])

  const visibleNav = navAll.filter(item => !item.perm || can(item.perm))
  if (isAdmin && IS_VAION) visibleNav.push(monitoreoItem)

  return (
    <aside
      className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 z-30"
      style={{ top: 'var(--env-banner-h)', height: 'calc(100vh - var(--env-banner-h))', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
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

      {/* Empresa activa (fija, sin selector) */}
      {empresa && (
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center font-display font-bold rounded-lg"
              style={{
                width: 26, height: 26, fontSize: 8,
                background: 'var(--amber-dim)',
                border: '1px solid rgba(255,149,0,0.2)',
                color: 'var(--amber)',
              }}
            >
              {empresa.slug.split('-').map(w => w[0].toUpperCase()).join('').slice(0, 2)}
            </div>

            <span
              className="flex-1 text-left font-display font-bold truncate"
              style={{ fontSize: 9.5, letterSpacing: '-0.01em', color: 'var(--text)' }}
            >
              {empresa.nombre}
            </span>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="px-4 py-4">
        <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary w-full justify-center">
          <Plus size={15} strokeWidth={2.5} /> Subir Egreso
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
                {to === '/monitoreo' && errorCount > 0 && (
                  <span
                    className="ml-auto num text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ minWidth: 18, height: 18, padding: '0 5px', background: 'var(--red)', color: '#fff' }}
                  >
                    {errorCount > 99 ? '99+' : errorCount}
                  </span>
                )}
                {isActive && to !== '/monitoreo' && (
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
            onClick={toggle}
            className="transition-colors p-1 rounded-lg"
            style={{ color: 'var(--subtle)' }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
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
