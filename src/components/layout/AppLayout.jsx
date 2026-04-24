import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { Bell, Search, Building2 } from 'lucide-react'

export default function AppLayout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(6,7,9,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--amber)', boxShadow: '0 0 12px var(--amber-glow)' }}
          >
            <Building2 size={14} color="#000" strokeWidth={2.5} />
          </div>
          <div className="font-display text-[11px] font-bold" style={{ letterSpacing: '-0.01em' }}>
            <span style={{ color: 'var(--text)' }}>CONTROL </span>
            <span style={{ color: 'var(--amber)' }}>OBRAS 360°</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <Search size={16} />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors relative"
            style={{ color: 'var(--muted)' }}
          >
            <Bell size={16} />
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }}
            />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="lg:ml-60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-8 page-enter">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
