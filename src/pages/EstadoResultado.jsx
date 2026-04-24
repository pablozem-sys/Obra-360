import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react'
import { obras, gastos, ingresos } from '../data/mockData'
import { formatCLP, calcGastosObra, calcIngresosObra, CATEGORIAS_GASTO } from '../lib/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1E35] border border-[#2A2E4A] rounded-xl p-3 text-xs shadow-xl">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      <p style={{ color: payload[0]?.color }}>{formatCLP(payload[0]?.value)}</p>
    </div>
  )
}

export default function EstadoResultado() {
  const [selectedId, setSelectedId] = useState('all')

  const obrasFiltradas = selectedId === 'all' ? obras : obras.filter(o => o.id === selectedId)

  const totalIngresos = obrasFiltradas.reduce((s, o) => s + calcIngresosObra(ingresos, o.id), 0)
  const totalGastos = obrasFiltradas.reduce((s, o) => s + calcGastosObra(gastos, o.id), 0)
  const margen = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100) : 0
  const desviacion = selectedId !== 'all' ? (() => {
    const obra = obras.find(o => o.id === selectedId)
    return obra ? ((totalGastos - obra.presupuesto) / obra.presupuesto * 100) : 0
  })() : null

  // Gastos por categoría for chart
  const gastosPorCat = Object.entries(
    obrasFiltradas.flatMap(o => gastos.filter(g => g.obraId === o.id)).reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
      return acc
    }, {})
  ).map(([cat, monto]) => ({
    name: CATEGORIAS_GASTO[cat]?.label || cat,
    monto,
    color: CATEGORIAS_GASTO[cat]?.color || '#64748B',
  })).sort((a, b) => b.monto - a.monto)

  // EERR por obra (para el detalle)
  const eerrPorObra = obras.map(o => {
    const g = calcGastosObra(gastos, o.id)
    const i = calcIngresosObra(ingresos, o.id)
    return { ...o, gastos: g, ingresos: i, margen: i > 0 ? ((i - g) / i * 100) : 0 }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Estado de Resultados</h1>
          <p className="text-slate-500 text-sm mt-0.5">Resultado económico por obra</p>
        </div>
        <select
          className="select max-w-[200px]"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="all">Todas las obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-500 font-medium">Ingresos</span>
          </div>
          <p className="font-display font-bold text-xl text-emerald-400">{formatCLP(totalIngresos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-slate-500 font-medium">Costos</span>
          </div>
          <p className="font-display font-bold text-xl text-red-400">{formatCLP(totalGastos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-amber-400" />
            <span className="text-xs text-slate-500 font-medium">Margen Bruto</span>
          </div>
          <p className={`font-display font-bold text-xl ${margen >= 20 ? 'text-emerald-400' : margen > 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {margen.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">{formatCLP(totalIngresos - totalGastos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className={desviacion != null ? (desviacion > 0 ? 'text-red-400' : 'text-emerald-400') : 'text-slate-500'} />
            <span className="text-xs text-slate-500 font-medium">Desviación</span>
          </div>
          {desviacion != null ? (
            <>
              <p className={`font-display font-bold text-xl ${desviacion > 10 ? 'text-red-400' : desviacion > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {desviacion > 0 ? '+' : ''}{desviacion.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">vs. presupuesto</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Selecciona una obra</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {gastosPorCat.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gastosPorCat} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={false} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                {gastosPorCat.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L table por obra */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2A2E4A]">
          <h2 className="section-title">Resultado por Obra</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-[#2A2E4A] bg-[#131629]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Obra</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Costos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resultado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Margen</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {eerrPorObra.map(o => {
                const resultado = o.ingresos - o.gastos
                const desv = o.presupuesto > 0 ? ((o.gastos - o.presupuesto) / o.presupuesto * 100) : 0
                return (
                  <tr key={o.id} className="table-row">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-200">{o.nombre}</p>
                      <p className="text-xs text-slate-500">{o.cliente}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-emerald-400">{formatCLP(o.ingresos)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-red-400">{formatCLP(o.gastos)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold ${resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCLP(resultado)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold ${o.margen >= 20 ? 'text-emerald-400' : o.margen > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {o.margen.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs text-slate-400">{formatCLP(o.presupuesto)}</span>
                      {desv !== 0 && (
                        <p className={`text-xs font-medium ${desv > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {desv > 0 ? '+' : ''}{desv.toFixed(0)}%
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
