export default function StatCard({ icon: Icon, label, value, sub, accent, trend, live }) {
  const themes = {
    amber:   { text: 'text-amber',  bg: 'bg-amber-dim',  border: 'border-amber',  line: 'var(--amber)',  glowDim: 'var(--amber-glow)' },
    emerald: { text: 'text-green',  bg: 'bg-green-dim',  border: 'border-green',  line: 'var(--green)',  glowDim: 'var(--green-dim)' },
    red:     { text: 'text-red',    bg: 'bg-red-dim',    border: 'border-red',    line: 'var(--red)',    glowDim: 'var(--red-dim)' },
    blue:    { text: 'text-blue',   bg: 'bg-blue-dim',   border: 'border-blue',   line: 'var(--blue)',   glowDim: 'var(--blue-dim)' },
    violet:  { text: 'text-violet', bg: 'bg-violet-dim', border: 'border-violet', line: 'var(--violet)', glowDim: 'var(--violet-dim)' },
    default: { text: 'text-[#ECEEF8]', bg: 'bg-[#1C1F2C]', border: 'border-[#1E2235]', line: '#272B45', glowDim: null },
  }
  const t = themes[accent] || themes.default

  return (
    <div className={`card p-5 flex flex-col gap-0 group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--border-light)]`}>
      {/* Left accent line */}
      <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{
          background: t.line,
          boxShadow: t.glowDim ? `0 0 12px ${t.glowDim}` : 'none'
        }}
      />

      {/* Background radial glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: t.glowDim ?? 'transparent' }}
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
