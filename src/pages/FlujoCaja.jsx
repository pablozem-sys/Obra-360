import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, Loader2 } from 'lucide-react'
import { getGastos, getIngresos } from '../lib/supabase'
import { formatCLP } from '../lib/helpers'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl space-y-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <p className="font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.dataKey === 'ingresos' ? 'Ingresos' : p.dataKey === 'egresos' ? 'Egresos' : 'Saldo'}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

function buildMonthly(gastos, ingresos) {
  const map = {}
  gastos.forEach(g => {
    if (!g.fecha) return
    const d = new Date(g.fecha)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    if (!map[key]) map[key] = { label: MESES[d.getMonth()], ingresos: 0, egresos: 0 }
    map[key].egresos += g.monto ?? 0
  })
  ingresos.forEach(i => {
    if (!i.fecha) return
    const d = new Date(i.fecha)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`
    if (!map[key]) map[key] = { label: MESES[d.getMonth()], ingresos: 0, egresos: 0 }
    map[key].ingresos += i.monto ?? 0
  })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-8)
    .map(([, v]) => ({ mes: v.label, ingresos: v.ingresos, egresos: v.egresos, saldo: v.ingresos - v.egresos }))
}

function buildWeekly(gastos, ingresos) {
  const map = {}
  const getWeekKey = fecha => {
    const d = new Date(fecha)
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay())
    return start.toISOString().split('T')[0]
  }
  const fmt = key => { const d = new Date(key); return `${d.getDate()}/${d.getMonth() + 1}` }
  gastos.forEach(g => {
    if (!g.fecha) return
    const key = getWeekKey(g.fecha)
    if (!map[key]) map[key] = { ingresos: 0, egresos: 0 }
    map[key].egresos += g.monto ?? 0
  })
  ingresos.forEach(i => {
    if (!i.fecha) return
    const key = getWeekKey(i.fecha)
    if (!map[key]) map[key] = { ingresos: 0, egresos: 0 }
    map[key].ingresos += i.monto ?? 0
  })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-8)
    .map(([key, v]) => ({ semana: fmt(key), ingresos: v.ingresos, egresos: v.egresos, saldo: v.ingresos - v.egresos }))
}

export default function FlujoCaja() {
  const [view,     setView]     = useState('mensual')
  const [gastos,   setGastos]   = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([getGastos().catch(() => []), getIngresos().catch(() => [])])
      .then(([g, i]) => { setGastos(g); setIngresos(i) })
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const data = useMemo(() =>
    view === 'mensual' ? buildMonthly(gastos, ingresos) : buildWeekly(gastos, ingresos),
    [view, gastos, ingresos]
  )
  const xKey = view === 'mensual' ? 'mes' : 'semana'

  const totalIngresos    = data.reduce((s, d) => s + d.ingresos, 0)
  const totalEgresos     = data.reduce((s, d) => s + d.egresos, 0)
  const saldoProyectado  = data[data.length - 1]?.saldo ?? 0
  const alertaCaja       = data.some(d => d.saldo < 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Flujo de Caja</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Ingresos y egresos reales</p>
        </div>
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {['mensual', 'semanal'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-150"
              style={{ background: view === v ? 'var(--amber)' : 'transparent', color: view === v ? '#0A0C1A' : 'var(--muted)' }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {alertaCaja && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,69,96,0.05)', border: '1px solid rgba(255,69,96,0.2)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--red)' }}>Alerta de caja negativa</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Hay períodos con saldo negativo. Revisa los pagos pendientes.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} style={{ color: 'var(--green)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Ingresos</span></div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--green)' }}>{formatCLP(totalIngresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={14} style={{ color: 'var(--red)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Egresos</span></div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--red)' }}>{formatCLP(totalEgresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><Wallet size={14} style={{ color: saldoProyectado >= 0 ? 'var(--amber)' : 'var(--red)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Saldo período</span></div>
          <p className="font-display font-bold text-lg" style={{ color: saldoProyectado >= 0 ? 'var(--amber)' : 'var(--red)' }}>{formatCLP(saldoProyectado)}</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin datos financieros registrados</p>
        </div>
      ) : (
        <>
          <div className="card p-5">
            <h2 className="section-title mb-4">Ingresos vs Egresos</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C48C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00C48C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4560" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4560" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="ingresos" stroke="#00C48C" strokeWidth={2} fill="url(#gi)" />
                <Area type="monotone" dataKey="egresos"  stroke="#FF4560" strokeWidth={2} fill="url(#ge)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />Ingresos</div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)' }} />Egresos</div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="section-title mb-4">Saldo por Período</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" />
                <Bar dataKey="saldo" radius={[4, 4, 0, 0]} fill="var(--amber)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="section-title">Detalle {view === 'mensual' ? 'Mensual' : 'Semanal'}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    {[view === 'mensual' ? 'Mes' : 'Semana', 'Ingresos', 'Egresos', 'Saldo'].map((h, i) => (
                      <th key={h} className={`px-${i === 0 ? '5' : '4'} py-3 text-${i === 0 ? 'left' : 'right'} text-xs font-semibold uppercase tracking-wider`} style={{ color: 'var(--subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--text)' }}>{d[xKey]}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold" style={{ color: 'var(--green)' }}>{formatCLP(d.ingresos)}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold" style={{ color: 'var(--red)' }}>{formatCLP(d.egresos)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold" style={{ color: d.saldo >= 0 ? 'var(--amber)' : 'var(--red)' }}>{formatCLP(d.saldo)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
