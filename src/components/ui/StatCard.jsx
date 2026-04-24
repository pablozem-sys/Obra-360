export default function StatCard({ icon: Icon, label, value, sub, accent, trend, live }) {
  const themes = {
    amber:   { text: 'text-amber',  bg: 'bg-amber-dim',  border: 'border-amber',  glow: 'glow-amber' },
    emerald: { text: 'text-green',  bg: 'bg-green-dim',  border: 'border-green',  glow: 'glow-green' },
    red:     { text: 'text-red',    bg: 'bg-red-dim',    border: 'border-red',    glow: 'glow-red' },
    blue:    { text: 'text-[#4361EE]', bg: 'bg-blue-dim', border: 'border-[rgba(67,97,238,0.3)]', glow: '' },
    violet:  { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: '' },
    default: { text: 'text-[#ECEEF8]', bg: 'bg-[#1C1F2C]', border: 'border-[#1E2235]', glow: '' },
  }
  const t = themes[accent] || themes.default

  return (
    <div className={`card p-5 flex flex-col gap-0 group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--border-light)]`}>
      {/* Left accent line */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${accent === 'amber' ? 'bg-amber' : accent === 'emerald' ? 'bg-green' : accent === 'red' ? 'bg-red' : 'bg-[#272B45]'}`}
        style={{
          background: accent === 'amber' ? 'var(--amber)' : accent === 'emerald' ? 'var(--green)' : accent === 'red' ? 'var(--red)' : accent === 'blue' ? 'var(--blue)' : '#272B45',
          boxShadow: accent && accent !== 'default' ? `0 0 12px ${accent === 'amber' ? 'var(--amber-glow)' : accent === 'emerald' ? 'var(--green-dim)' : 'var(--red-dim)'}` : 'none'
        }}
      />

      {/* Background radial glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: accent === 'amber' ? 'var(--amber-dim)' : accent === 'emerald' ? 'var(--green-dim)' : accent === 'red' ? 'var(--red-dim)' : 'transparent' }}
      />

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 border ${t.bg} ${t.border}`}>
        <Icon size={16} className={t.text} />
      </div>

      {/* Value */}
      <div className={`num font-mono font-medium text-2xl leading-none mb-1.5 ${t.text}`}>
        {value}
      </div>

      {/* Label */}
      <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[0.08em] mb-1">{label}</p>

      {/* Sub + trend */}
      <div className="flex items-center justify-between mt-1">
        {sub && (
          <div className="flex items-center gap-1.5">
            {live && <span className="live-dot" />}
            <p className="text-[11px] text-[var(--muted)]">{sub}</p>
          </div>
        )}
        {trend != null && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ml-auto ${
            trend >= 0 ? 'bg-green-dim text-green border border-green' : 'bg-red-dim text-red border border-red'
          }`}
            style={{
              borderColor: trend >= 0 ? 'rgba(0,196,140,0.3)' : 'rgba(255,69,96,0.3)',
              color: trend >= 0 ? 'var(--green)' : 'var(--red)',
              background: trend >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
            }}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}
