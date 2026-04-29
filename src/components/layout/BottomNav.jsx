import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Plus, Users, FolderOpen } from 'lucide-react'

const items = [
  { to: '/dashboard',          label: 'Inicio',     icon: LayoutDashboard },
  { to: '/obras',              label: 'Obras',      icon: Building2 },
  { to: '/asistencia-control', label: 'Asistencia', icon: Users },
  { to: '/documentos',         label: 'Docs',       icon: FolderOpen },
]

export default function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{
        background: 'rgba(13,14,22,0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.slice(0, 2).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors"
          style={({ isActive }) => ({ color: isActive ? 'var(--amber)' : 'var(--subtle)' })}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              {label}
            </>
          )}
        </NavLink>
      ))}

      {/* FAB */}
      <div className="flex-1 flex justify-center relative -top-4">
        <button
          onClick={() => navigate('/gastos/nuevo')}
          className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--amber)',
            boxShadow: '0 4px 24px var(--amber-glow), 0 0 0 1px rgba(255,149,0,0.4)',
          }}
        >
          <Plus size={26} color="#000" strokeWidth={2.5} />
        </button>
      </div>

      {items.slice(2).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors"
          style={({ isActive }) => ({ color: isActive ? 'var(--amber)' : 'var(--subtle)' })}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
