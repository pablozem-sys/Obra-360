import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, Plus, ArrowRight, Wallet, Clock, Users, Loader2
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import {
  getObras, getGastos, getIngresos,
  getCuentasPagar, getCuentasCobrar, getAttendance
} from '../lib/supabase'
import {
  formatCLP, calcGastosObra, calcIngresosObra,
  ESTADOS_OBRA, TIPOS_OBRA, CATEGORIAS_GASTO
} from '../lib/helpers'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
      <p className="font-semibold mb-2" style={{ color: 'var(--muted)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-mono font-medium" style={{ color: p.color }}>
          {p.dataKey === 'ingresos' ? 'Ingresos' : 'Egresos'}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

const CBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs shadow-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
      <p className="font-mono font-medium" style={{ color: 'var(--amber)' }}>{label}</p>
      <p className="font-mono" style={{ color: 'var(--text)' }}>{formatCLP(payload[0]?.value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { can } = useAuth()

  const [obras,       setObras]       = useState([])
  const [gastos,      setGastos]      = useState([])
  const [ingresos,    setIngresos]    = useState([])
  const [cuentasPagar,   setCuentasPagar]   = useState([])
  const [cuentasCobrar,  setCuentasCobrar]  = useState([])
  const [asistencia,  setAsistencia]  = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000)
    Promise.all([
      getObras().catch(() => []),
      getGastos().catch(() => []),
      getIngresos().catch(() => []),
      getCuentasPagar().catch(() => []),
      getCuentasCobrar().catch(() => []),
      getAttendance().catch(() => []),
    ]).then(([o, g, i, cp, cc, a]) => {
      setObras(o)
      setGastos(g)
      setIngresos(i)
      setCuentasPagar(cp)
      setCuentasCobrar(cc)
      setAsistencia(a)
    }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const totalIngresos   = ingresos.reduce((s, i) => s + (i.monto ?? 0), 0)
  const totalGastos     = gastos.reduce((s, g) => s + (g.monto ?? 0), 0)
  const totalManoObra   = asistencia.reduce((s, r) => s + (r.costo_total ?? 0), 0)
  const totalGastosReal = totalGastos + totalManoObra
  const margen          = totalIngresos > 0 ? ((totalIngresos - totalGastosReal) / totalIngresos * 100).toFixed(1) : 0
  const obrasActivas    = obras.filter(o => o.estado === 'en_ejecucion')
  const cxpPendiente    = cuentasPagar.filter(c => c.estado !== 'pagado').reduce((s, c) => s + (c.monto ?? 0), 0)
  const cxcPendiente    = cuentasCobrar.filter(c => c.estado !== 'cobrado').reduce((s, c) => s + (c.saldo_pendiente ?? 0), 0)
  const enObraAhora     = asistencia.filter(r => !r.salida).length

  const alertas = obrasActivas.filter(o => {
    const g = calcGastosObra(gastos, o.id)
    return o.presupuesto && g > o.presupuesto * 0.85
  })

  const gastosCat = useMemo(() => Object.entries(
    gastos.reduce((acc, g) => { acc[g.categoria] = (acc[g.categoria] || 0) + g.monto; return acc }, {})
  ).map(([cat, monto]) => ({
    cat: CATEGORIAS_GASTO[cat]?.label || cat,
    monto,
    fill: CATEGORIAS_GASTO[cat]?.color || '#353A57',
  })).sort((a, b) => b.monto - a.monto), [gastos])

  const flujoCajaData = useMemo(() => {
    const map = {}
    gastos.forEach(g => {
      if (!g.fecha) return
      const d = new Date(g.fecha)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map[key]) map[key] = { mes: MESES[d.getMonth()], ingresos: 0, egresos: 0, order: d.getFullYear() * 12 + d.getMonth() }
      map[key].egresos += g.monto ?? 0
    })
    ingresos.forEach(i => {
      if (!i.fecha) return
      const d = new Date(i.fecha)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!map[key]) map[key] = { mes: MESES[d.getMonth()], ingresos: 0, egresos: 0, order: d.getFullYear() * 12 + d.getMonth() }
      map[key].ingresos += i.monto ?? 0
    })
    return Object.values(map).sort((a, b) => a.order - b.order).slice(-6)
  }, [gastos, ingresos])

  const ultimosGastos = [...gastos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Hero header ─────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="amber-dot" />
            <p style={{ fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              VAION // en vivo
            </p>
          </div>
          <h1 className="font-display font-bold text-[28px] leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
            {obrasActivas.length} obras activas
          </p>
        </div>
        <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary hidden sm:flex">
          <Plus size={15} strokeWidth={2.5} />
          Subir Gasto
        </button>
      </div>

      {/* ── Alertas ──────────────────────────────── */}
      {alertas.length > 0 && (
        <div
          className="stripe-alert rounded-2xl p-4"
          style={{ background: 'rgba(255,69,96,0.04)', border: '1px solid rgba(255,69,96,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
            <span className="text-[12px] font-bold" style={{ color: 'var(--red)', fontFamily: 'Unbounded' }}>
              {alertas.length} OBRA{alertas.length > 1 ? 'S' : ''} EN ALERTA DE COSTO
            </span>
          </div>
          {alertas.map(o => {
            const g = calcGastosObra(gastos, o.id)
            const pct = (g / o.presupuesto * 100).toFixed(0)
            return (
              <div
                key={o.id}
                onClick={() => navigate(`/obras/${o.id}`)}
                className="flex items-center justify-between cursor-pointer px-3 py-2 rounded-xl transition-colors"
                style={{ borderRadius: 10 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,96,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span className="text-sm" style={{ color: 'var(--text)' }}>{o.nombre}</span>
                <div className="flex items-center gap-3">
                  <span className="num text-xs font-medium" style={{ color: 'var(--red)' }}>{pct}% del presupuesto</span>
                  <ArrowRight size={13} style={{ color: 'rgba(255,69,96,0.5)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Section 01 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>01</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Indicadores</span>
      </div>

      {/* ── Stats grid ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={Building2}    label="Obras Activas"    value={String(obrasActivas.length)}     sub={`${obras.length} proyectos en total`}                accent="blue" />
        <StatCard icon={Users}        label="En obra ahora"    value={String(enObraAhora)}              sub="Trabajadores con entrada activa"                     accent="emerald" live />
        <StatCard icon={TrendingDown} label="Gastos + MO"      value={formatCLP(totalGastosReal)}       sub={`MO: ${formatCLP(totalManoObra)}`}                   accent="red" />
        {can('verIngresos') && (
          <StatCard icon={TrendingUp} label="Ingresos"         value={formatCLP(totalIngresos)}         sub="Cobrado hasta hoy"                                   accent="emerald" trend={12} />
        )}
        {can('verMargen') && (
          <StatCard icon={DollarSign} label="Margen Bruto"     value={`${margen}%`}                     sub={formatCLP(totalIngresos - totalGastosReal)}          accent={parseFloat(margen) >= 20 ? 'emerald' : 'amber'} />
        )}
        <StatCard icon={Clock}        label="Cuentas x Pagar"  value={formatCLP(cxpPendiente)}          sub="Pendientes + vencidas"                               accent="amber" />
        {can('verCxC') && (
          <StatCard icon={Wallet}     label="Cuentas x Cobrar" value={formatCLP(cxcPendiente)}          sub="Saldo por cobrar"                                    accent="violet" />
        )}
      </div>

      {/* ── Section 02 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>02</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Financiero</span>
      </div>

      {/* ── Charts ───────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Flujo de caja */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="section-title">Flujo de Caja</h2>
            <button
              onClick={() => navigate('/flujo-caja')}
              className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}
            >
              VER <ArrowRight size={11} />
            </button>
          </div>
          {flujoCajaData.length === 0 ? (
            <div className="flex items-center justify-center h-[180px]">
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin datos financieros aún</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={flujoCajaData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00C48C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00C48C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF4560" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#FF4560" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={<CTooltip />} />
                <Area type="monotone" dataKey="ingresos" stroke="#00C48C" strokeWidth={2} fill="url(#gi)" />
                <Area type="monotone" dataKey="egresos"  stroke="#FF4560" strokeWidth={2} fill="url(#ge)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green-dim)' }} />
              Ingresos
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 6px var(--red-dim)' }} />
              Egresos
            </div>
          </div>
        </div>

        {/* Distribución gastos */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="section-title mb-5">Gastos por Categoría</h2>
          {gastosCat.length === 0 ? (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin gastos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gastosCat.slice(0, 5).map(({ cat, monto, fill }) => {
                const pct = (monto / totalGastos * 100).toFixed(0)
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{cat}</span>
                      <span className="num text-[11px] font-medium" style={{ color: fill }}>{pct}%</span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: fill, boxShadow: `0 0 8px ${fill}` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Total Gastos</p>
            <p className="num text-xl font-medium" style={{ color: 'var(--text)' }}>{formatCLP(totalGastos)}</p>
          </div>
        </div>
      </div>

      {/* ── Section 03 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>03</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Obras en ejecución</span>
      </div>

      {/* ── Obras activas ────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Obras en Ejecución</h2>
          <button
            onClick={() => navigate('/obras')}
            className="flex items-center gap-1 text-[11px] font-bold transition-colors"
            style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}
          >
            VER TODAS <ArrowRight size={11} />
          </button>
        </div>
        {obrasActivas.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>No hay obras en ejecución</p>
            <button onClick={() => navigate('/obras')} className="btn-secondary mt-4 text-xs">
              <Plus size={12} /> Crear obra
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {obrasActivas.map((o, idx) => {
              const g = calcGastosObra(gastos, o.id)
              const pctG = o.presupuesto ? Math.min((g / o.presupuesto) * 100, 100).toFixed(0) : 0
              const over = o.presupuesto && g > o.presupuesto
              return (
                <div
                  key={o.id}
                  onClick={() => navigate(`/obras/${o.id}`)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer group transition-all duration-200"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 num text-[11px] font-medium"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--muted)' }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{o.nombre}</span>
                      {o.tipo && <Badge className={TIPOS_OBRA[o.tipo]?.color}>{TIPOS_OBRA[o.tipo]?.label}</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pctG}%`,
                            background: over ? 'var(--red)' : 'var(--amber)',
                            boxShadow: `0 0 6px ${over ? 'var(--red-dim)' : 'var(--amber-glow)'}`,
                          }}
                        />
                      </div>
                      <span className="num text-[11px] flex-shrink-0" style={{ color: over ? 'var(--red)' : 'var(--muted)' }}>
                        {pctG}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="num text-sm font-medium" style={{ color: 'var(--text)' }}>{formatCLP(g)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{o.presupuesto ? `de ${formatCLP(o.presupuesto)}` : 'sin presupuesto'}</p>
                  </div>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--subtle)' }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 04 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>04</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Últimos gastos</span>
      </div>

      {/* ── Últimos gastos ───────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Últimos Gastos</h2>
          <button onClick={() => navigate('/gastos/nuevo')} className="btn-ghost text-[12px]" style={{ color: 'var(--amber)' }}>
            <Plus size={13} /> Subir
          </button>
        </div>
        {ultimosGastos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>No hay gastos registrados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['Proveedor / Categoría', 'Obra', 'Monto', 'Fecha'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left"
                      style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimosGastos.map(g => {
                  const obra = obras.find(o => o.id === g.project_id)
                  const cat  = CATEGORIAS_GASTO[g.categoria]
                  return (
                    <tr key={g.id} className="table-row" style={{ cursor: 'default' }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat?.color, boxShadow: `0 0 6px ${cat?.color}` }} />
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{g.proveedor}</p>
                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{cat?.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] truncate block max-w-[130px]" style={{ color: 'var(--muted)' }}>{obra?.nombre ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="num text-[13px] font-medium" style={{ color: 'var(--text)' }}>{formatCLP(g.monto)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>{g.fecha}</span>
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
