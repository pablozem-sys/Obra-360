import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Target, Loader2 } from 'lucide-react'
import { getObras, getGastos, getIngresos } from '../lib/supabase'
import { formatCLP, calcGastosObra, calcIngresosObra, CATEGORIAS_GASTO } from '../lib/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{label}</p>
      <p style={{ color: payload[0]?.color }}>{formatCLP(payload[0]?.value)}</p>
    </div>
  )
}

export default function EstadoResultado() {
  const [selectedId, setSelectedId] = useState('all')
  const [obras,    setObras]    = useState([])
  const [gastos,   setGastos]   = useState([])
  const [ingresos, setIngresos] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getObras().catch(() => []),
      getGastos().catch(() => []),
      getIngresos().catch(() => []),
    ]).then(([o, g, i]) => { setObras(o); setGastos(g); setIngresos(i) })
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const obrasFiltradas = selectedId === 'all' ? obras : obras.filter(o => o.id === selectedId)

  const totalIngresos = obrasFiltradas.reduce((s, o) => s + calcIngresosObra(ingresos, o.id), 0)
  const totalGastos   = obrasFiltradas.reduce((s, o) => s + calcGastosObra(gastos, o.id), 0)
  const margen        = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100) : 0
  const desviacion    = selectedId !== 'all' ? (() => {
    const obra = obras.find(o => o.id === selectedId)
    return obra?.presupuesto ? ((totalGastos - obra.presupuesto) / obra.presupuesto * 100) : null
  })() : null

  const gastosPorCat = useMemo(() => Object.entries(
    obrasFiltradas.flatMap(o => gastos.filter(g => g.project_id === o.id)).reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
      return acc
    }, {})
  ).map(([cat, monto]) => ({
    name: CATEGORIAS_GASTO[cat]?.label || cat,
    monto,
    color: CATEGORIAS_GASTO[cat]?.color || '#64748B',
  })).sort((a, b) => b.monto - a.monto), [obrasFiltradas, gastos])

  const eerrPorObra = obras.map(o => {
    const g = calcGastosObra(gastos, o.id)
    const i = calcIngresosObra(ingresos, o.id)
    return { ...o, gastos: g, ingresos: i, margen: i > 0 ? ((i - g) / i * 100) : 0 }
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Estado de Resultados</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Resultado económico por obra</p>
        </div>
        <select className="select max-w-[200px]" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="all">Todas las obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: 'var(--green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Ingresos</span>
          </div>
          <p className="font-display font-bold text-xl" style={{ color: 'var(--green)' }}>{formatCLP(totalIngresos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} style={{ color: 'var(--red)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Costos</span>
          </div>
          <p className="font-display font-bold text-xl" style={{ color: 'var(--red)' }}>{formatCLP(totalGastos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Margen Bruto</span>
          </div>
          <p className="font-display font-bold text-xl" style={{ color: margen >= 20 ? 'var(--green)' : margen > 0 ? 'var(--amber)' : 'var(--red)' }}>
            {margen.toFixed(1)}%
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{formatCLP(totalIngresos - totalGastos)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} style={{ color: desviacion != null ? (desviacion > 0 ? 'var(--red)' : 'var(--green)') : 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Desviación</span>
          </div>
          {desviacion != null ? (
            <>
              <p className="font-display font-bold text-xl" style={{ color: desviacion > 10 ? 'var(--red)' : desviacion > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {desviacion > 0 ? '+' : ''}{desviacion.toFixed(1)}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>vs. presupuesto</p>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Selecciona una obra</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {gastosPorCat.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gastosPorCat} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={false} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                {gastosPorCat.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Resultado por Obra</h2>
        </div>
        {eerrPorObra.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>Sin obras registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['Obra', 'Ingresos', 'Costos', 'Resultado', 'Margen', 'Presupuesto'].map(h => (
                    <th key={h} className={`px-${h === 'Obra' ? '5' : '4'} py-3 text-${h === 'Obra' ? 'left' : 'right'} text-xs font-semibold uppercase tracking-wider`} style={{ color: 'var(--subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eerrPorObra.map(o => {
                  const resultado = o.ingresos - o.gastos
                  const desv = o.presupuesto > 0 ? ((o.gastos - o.presupuesto) / o.presupuesto * 100) : 0
                  return (
                    <tr key={o.id} className="table-row">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{o.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{o.clients?.nombre ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: 'var(--green)' }}>{formatCLP(o.ingresos)}</span></td>
                      <td className="px-4 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: 'var(--red)' }}>{formatCLP(o.gastos)}</span></td>
                      <td className="px-4 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: resultado >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCLP(resultado)}</span></td>
                      <td className="px-4 py-3.5 text-right"><span className="text-sm font-semibold" style={{ color: o.margen >= 20 ? 'var(--green)' : o.margen > 0 ? 'var(--amber)' : 'var(--red)' }}>{o.margen.toFixed(1)}%</span></td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{o.presupuesto ? formatCLP(o.presupuesto) : '—'}</span>
                        {desv !== 0 && o.presupuesto > 0 && (
                          <p className="text-xs font-medium" style={{ color: desv > 0 ? 'var(--red)' : 'var(--green)' }}>
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
        )}
      </div>
    </div>
  )
}
