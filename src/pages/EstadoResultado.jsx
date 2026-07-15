import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Percent, Loader2 } from 'lucide-react'
import { getObras, getGastos, getAttendance, getAllAdditionalSales } from '../lib/supabase'
import { formatCLP, CATEGORIAS_GASTO } from '../lib/helpers'

const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="num font-medium" style={{ color: payload[0]?.fill }}>{formatCLP(payload[0]?.value)}</p>
    </div>
  )
}

function calcObraData(obra, gastos, asistencia, additionalSales) {
  const ventaAprobada  = obra.presupuesto ?? 0
  const ventaAdicional = additionalSales.filter(a => a.project_id === obra.id).reduce((s, a) => s + (a.tipo === 'descuento' ? -(a.monto ?? 0) : (a.monto ?? 0)), 0)
  const ventaTotal     = ventaAprobada + ventaAdicional
  const cdo            = gastos
    .filter(g => g.project_id === obra.id && CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra')
    .reduce((s, g) => s + (g.monto ?? 0), 0)
  const mod            = asistencia
    .filter(a => a.project_id === obra.id)
    .reduce((s, a) => s + (a.costo_total ?? 0), 0)
  const margen         = ventaTotal - cdo - mod
  const pctMargen      = ventaTotal > 0 ? (margen / ventaTotal * 100) : 0
  return { ventaTotal, ventaAprobada, ventaAdicional, cdo, mod, margen, pctMargen }
}

export default function EstadoResultado() {
  const [selectedId,      setSelectedId]      = useState('all')
  const [obras,           setObras]           = useState([])
  const [gastos,          setGastos]          = useState([])
  const [asistencia,      setAsistencia]      = useState([])
  const [additionalSales, setAdditionalSales] = useState([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getObras().catch(() => []),
      getGastos().catch(() => []),
      getAttendance().catch(() => []),
      getAllAdditionalSales().catch(() => []),
    ]).then(([o, g, a, as_]) => { setObras(o); setGastos(g); setAsistencia(a); setAdditionalSales(as_) })
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const obrasFiltradas = selectedId === 'all' ? obras : obras.filter(o => o.id === selectedId)

  const totales = useMemo(() => {
    const ventaTotal = obrasFiltradas.reduce((s, o) => {
      const d = calcObraData(o, gastos, asistencia, additionalSales)
      return s + d.ventaTotal
    }, 0)
    const cdo = obrasFiltradas.reduce((s, o) => {
      const d = calcObraData(o, gastos, asistencia, additionalSales)
      return s + d.cdo
    }, 0)
    const mod = selectedId === 'all'
      ? asistencia.reduce((s, a) => s + (a.costo_total ?? 0), 0)
      : asistencia.filter(a => a.project_id === selectedId).reduce((s, a) => s + (a.costo_total ?? 0), 0)
    const gav = gastos
      .filter(g => CATEGORIAS_GASTO[g.categoria]?.grupo === 'Gastos Generales')
      .reduce((s, g) => s + (g.monto ?? 0), 0)
    const margen     = ventaTotal - cdo - mod
    const pctMargen  = ventaTotal > 0 ? (margen / ventaTotal * 100) : 0
    const utilidad   = ventaTotal - cdo - mod - gav
    const pctUtilidad = ventaTotal > 0 ? (utilidad / ventaTotal * 100) : 0
    return { ventaTotal, cdo, mod, gav, margen, pctMargen, utilidad, pctUtilidad }
  }, [obrasFiltradas, gastos, asistencia, additionalSales, selectedId])

  const isAll = selectedId === 'all'

  const resultadoValor = isAll ? totales.utilidad   : totales.margen
  const resultadoPct   = isAll ? totales.pctUtilidad : totales.pctMargen
  const resultadoLabel = isAll ? 'Utilidad'          : 'Margen'
  const resultadoColor = resultadoPct >= 20 ? 'var(--green)' : resultadoValor > 0 ? 'var(--amber)' : 'var(--red)'

  const chartData = [
    { name: 'Venta',         value: totales.ventaTotal,            fill: 'var(--blue)'  },
    { name: 'CDO',           value: totales.cdo,                   fill: 'var(--red)'   },
    { name: 'MOD',           value: totales.mod,                   fill: 'var(--amber)' },
    ...(isAll ? [{ name: 'GAV', value: totales.gav,                fill: 'var(--violet)' }] : []),
    { name: resultadoLabel,  value: Math.abs(resultadoValor),      fill: resultadoColor },
  ]

  const eerrPorObra = obras.map(o => ({ ...o, ...calcObraData(o, gastos, asistencia, additionalSales) }))

  const eerrFilas = [
    { label: 'Venta Total',             value: totales.ventaTotal, color: 'var(--blue)',   bold: false },
    { label: '↳ Costos Directos (CDO)', value: totales.cdo,        color: 'var(--red)',    bold: false, indent: true },
    { label: '↳ Mano de Obra (MOD)',    value: totales.mod,        color: 'var(--amber)',  bold: false, indent: true },
    ...(isAll ? [{ label: '↳ GAV',     value: totales.gav,        color: 'var(--violet)', bold: false, indent: true }] : []),
    { label: resultadoLabel,            value: resultadoValor,     color: resultadoColor,  bold: true },
    { label: `% ${resultadoLabel}`,     value: null,               color: resultadoColor,  bold: true, pct: resultadoPct },
  ]

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Estado de Resultados</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Resultado económico por obra</p>
        </div>
        <select className="select max-w-[220px]" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="all">Todas las obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp,   label: 'Venta Total',    value: formatCLP(totales.ventaTotal), color: 'var(--blue)'  },
          { icon: TrendingDown, label: 'CDO',            value: formatCLP(totales.cdo),        color: 'var(--red)'  },
          { icon: TrendingDown, label: 'MOD',            value: formatCLP(totales.mod),        color: 'var(--amber)'},
          { icon: DollarSign,   label: resultadoLabel,   value: formatCLP(resultadoValor),     color: resultadoColor },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} style={{ color }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>{label}</span>
            </div>
            <p className="font-display font-bold text-xl num" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* P&L summary */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Estado de Resultados</h2>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {eerrFilas.map(({ label, value, color, bold, indent, pct }) => (
            <div
              key={label}
              className="flex items-center justify-between px-5 py-3.5"
              style={{ background: bold ? 'var(--bg-surface)' : 'transparent' }}
            >
              <span
                className={`text-sm ${indent ? 'pl-3' : ''}`}
                style={{ color: indent ? 'var(--muted)' : 'var(--text)', fontWeight: bold ? 600 : 400 }}
              >
                {label}
              </span>
              <span
                className="num text-sm"
                style={{ color, fontWeight: bold ? 700 : 500 }}
              >
                {pct != null
                  ? `${pct.toFixed(1)}%`
                  : value != null ? formatCLP(value) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div className="card p-5">
        <h2 className="section-title mb-5">Resumen Visual</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono' }}
              axisLine={false} tickLine={false}
            />
            <YAxis tick={false} axisLine={false} tickLine={false} />
            <Tooltip content={<CTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-5 mt-2 flex-wrap">
          {chartData.map(({ name, fill }) => (
            <div key={name} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: fill }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Tabla por obra */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Resultado por Obra</h2>
        </div>
        {eerrPorObra.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>Sin obras registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['Obra', 'Venta', 'CDO', 'MOD', 'Margen', '% Margen'].map(h => (
                    <th key={h}
                      className={`px-5 py-3 text-${h === 'Obra' ? 'left' : 'right'}`}
                      style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eerrPorObra.map(o => {
                  const mColor = o.pctMargen >= 20 ? 'var(--green)' : o.margen > 0 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <tr key={o.id} className="table-row">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{o.nombre}</p>
                        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{o.clients?.nombre ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="num text-sm font-semibold" style={{ color: 'var(--blue)' }}>{formatCLP(o.ventaTotal)}</span>
                        {o.ventaAdicional > 0 && (
                          <p className="num text-[10px]" style={{ color: 'var(--muted)' }}>+{formatCLP(o.ventaAdicional)} adicional</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="num text-sm" style={{ color: 'var(--red)' }}>{formatCLP(o.cdo)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="num text-sm" style={{ color: 'var(--amber)' }}>{formatCLP(o.mod)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="num text-sm font-semibold" style={{ color: mColor }}>{formatCLP(o.margen)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="num text-sm font-bold" style={{ color: mColor }}>{o.pctMargen.toFixed(1)}%</span>
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
