import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { AlertTriangle, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { flujoCajaData, flujoCajaSemanData } from '../data/mockData'
import { formatCLP } from '../lib/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1E35] border border-[#2A2E4A] rounded-xl p-3 text-xs shadow-xl space-y-1">
      <p className="text-slate-400 font-semibold mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.dataKey === 'ingresos' ? 'Ingresos' : p.dataKey === 'egresos' ? 'Egresos' : 'Saldo'}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function FlujoCaja() {
  const [view, setView] = useState('mensual')

  const data = view === 'mensual' ? flujoCajaData : flujoCajaSemanData
  const xKey = view === 'mensual' ? 'mes' : 'semana'

  const totalIngresos = data.reduce((s, d) => s + d.ingresos, 0)
  const totalEgresos = data.reduce((s, d) => s + d.egresos, 0)
  const saldoProyectado = data[data.length - 1]?.saldo || 0
  const alertaCaja = data.some(d => d.saldo < 0)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Flujo de Caja</h1>
          <p className="text-slate-500 text-sm mt-0.5">Proyección de ingresos y egresos</p>
        </div>
        <div className="flex bg-[#1A1E35] border border-[#2A2E4A] rounded-xl p-1 gap-1">
          {['mensual', 'semanal'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-150 ${
                view === v ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Alert */}
      {alertaCaja && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Alerta de caja negativa</p>
            <p className="text-xs text-slate-400 mt-0.5">Hay períodos con saldo proyectado negativo. Revisa los pagos pendientes.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-500">Ingresos esperados</span>
          </div>
          <p className="font-display font-bold text-lg text-emerald-400">{formatCLP(totalIngresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-slate-500">Egresos esperados</span>
          </div>
          <p className="font-display font-bold text-lg text-red-400">{formatCLP(totalEgresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className={saldoProyectado >= 0 ? 'text-amber-400' : 'text-red-400'} />
            <span className="text-xs text-slate-500">Saldo proyectado</span>
          </div>
          <p className={`font-display font-bold text-lg ${saldoProyectado >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {formatCLP(saldoProyectado)}
          </p>
        </div>
      </div>

      {/* Area chart */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Ingresos vs Egresos</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2E4A" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={false} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={2} fill="url(#gi)" />
            <Area type="monotone" dataKey="egresos"  stroke="#EF4444" strokeWidth={2} fill="url(#ge)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ingresos
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Egresos
          </div>
        </div>
      </div>

      {/* Saldo bar chart */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Saldo Acumulado</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2E4A" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={false} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" />
            <Bar dataKey="saldo" radius={[4, 4, 0, 0]} fill="#D97706" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2A2E4A]">
          <h2 className="section-title">Detalle {view === 'mensual' ? 'Mensual' : 'Semanal'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2E4A] bg-[#131629]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {view === 'mensual' ? 'Mes' : 'Semana'}
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Egresos</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="table-row">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-200">{d[xKey]}</td>
                  <td className="px-4 py-3.5 text-right text-sm font-semibold text-emerald-400">{formatCLP(d.ingresos)}</td>
                  <td className="px-4 py-3.5 text-right text-sm font-semibold text-red-400">{formatCLP(d.egresos)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`text-sm font-semibold ${d.saldo >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {formatCLP(d.saldo)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
