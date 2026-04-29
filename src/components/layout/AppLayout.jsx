import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { Building2 } from 'lucide-react'

export default function AppLayout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center"
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
          <div className="font-display text-[13px] font-bold" style={{ letterSpacing: '-0.03em', fontFamily: 'Unbounded, sans-serif' }}>
            <span style={{ color: 'var(--amber)' }}>VAION</span>
          </div>
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
