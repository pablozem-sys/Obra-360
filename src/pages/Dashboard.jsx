import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, Percent,
  AlertTriangle, Plus, ArrowRight, Wallet, Loader2,
  Pencil, Trash2, X, AlertCircle
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import {
  getObras, getGastos, getIngresos,
  getAttendance, getAllAdditionalSales,
  updateGasto, deleteGasto,
} from '../lib/supabase'
import {
  formatCLP,
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
          {p.dataKey === 'ingresos' ? 'Venta' : 'Egresos'}: {formatCLP(p.value)}
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

  const [obras,           setObras]           = useState([])
  const [gastos,          setGastos]          = useState([])
  const [ingresos,        setIngresos]        = useState([])
  const [additionalSales, setAdditionalSales] = useState([])
  const [asistencia,      setAsistencia]      = useState([])
  const [loading,         setLoading]         = useState(true)

  const [editGasto,       setEditGasto]       = useState(null)
  const [editGastoForm,   setEditGastoForm]   = useState({})
  const [editGastoSaving, setEditGastoSaving] = useState(false)
  const [editGastoError,  setEditGastoError]  = useState('')
  const [confirmDelGasto, setConfirmDelGasto] = useState(null)
  const [deletingGasto,   setDeletingGasto]   = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000)
    Promise.all([
      getObras().catch(() => []),
      getGastos().catch(() => []),
      getIngresos().catch(() => []),
      getAllAdditionalSales().catch(() => []),
      getAttendance().catch(() => []),
    ]).then(([o, g, i, as_, a]) => {
      setObras(o)
      setGastos(g)
      setIngresos(i)
      setAdditionalSales(as_)
      setAsistencia(a)
    }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const ventaObras      = obras.reduce((s, o) => s + (o.presupuesto ?? 0), 0)
  const ventaAdicional  = additionalSales.reduce((s, a) => s + (a.monto ?? 0), 0)
  const totalIngresos   = ventaObras + ventaAdicional
  const totalManoObra   = asistencia.reduce((s, r) => s + (r.costo_total ?? 0), 0)
  const totalAbonos     = ingresos.reduce((s, i) => s + (i.monto ?? 0), 0)

  const gastosCDO       = gastos.filter(g => CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra').reduce((s, g) => s + (g.monto ?? 0), 0)
  const gastosGAV       = gastos.filter(g => CATEGORIAS_GASTO[g.categoria]?.grupo === 'Gastos Generales').reduce((s, g) => s + (g.monto ?? 0), 0)
  const totalGastos     = gastos.reduce((s, g) => s + (g.monto ?? 0), 0)
  const egresos         = totalGastos + totalManoObra
  const utilidad        = totalIngresos - egresos
  const pctUtilidad     = totalIngresos > 0 ? (utilidad / totalIngresos * 100).toFixed(1) : 0
  const obrasActivas    = obras.filter(o => o.estado === 'en_ejecucion')

  const alertas = obrasActivas.filter(o => {
    const cdo = gastos.filter(g => g.project_id === o.id && CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra').reduce((s, g) => s + (g.monto ?? 0), 0)
    const mod = asistencia.filter(a => a.project_id === o.id).reduce((s, a) => s + (a.costo_total ?? 0), 0)
    return o.presupuesto && (cdo + mod) > o.presupuesto * 0.85
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

  const openEditGasto = (g) => {
    setEditGasto(g)
    setEditGastoForm({
      monto:      String(g.monto ?? ''),
      categoria:  g.categoria ?? 'materiales',
      proveedor:  g.proveedor ?? '',
      fecha:      g.fecha ?? '',
      medio_pago: g.medio_pago ?? 'contado',
      comentario: g.comentario ?? '',
    })
    setEditGastoError('')
  }

  const handleSaveGasto = async () => {
    if (!editGastoForm.monto || !editGastoForm.proveedor) { setEditGastoError('Completa monto y proveedor'); return }
    setEditGastoSaving(true); setEditGastoError('')
    try {
      const updated = await updateGasto(editGasto.id, {
        monto:      parseInt(editGastoForm.monto),
        categoria:  editGastoForm.categoria,
        proveedor:  editGastoForm.proveedor,
        fecha:      editGastoForm.fecha,
        medio_pago: editGastoForm.medio_pago,
        comentario: editGastoForm.comentario || null,
      })
      setGastos(prev => prev.map(g => g.id === editGasto.id ? { ...g, ...updated } : g))
      setEditGasto(null)
    } catch (err) {
      setEditGastoError(err.message || 'Error al guardar')
    } finally {
      setEditGastoSaving(false)
    }
  }

  const handleDeleteGasto = async (id) => {
    setDeletingGasto(true)
    try {
      await deleteGasto(id)
      setGastos(prev => prev.filter(g => g.id !== id))
      setConfirmDelGasto(null)
    } catch { } finally { setDeletingGasto(false) }
  }

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
          Subir Egreso
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
            const cdo = gastos.filter(g => g.project_id === o.id && CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra').reduce((s, g) => s + (g.monto ?? 0), 0)
            const mod = asistencia.filter(a => a.project_id === o.id).reduce((s, a) => s + (a.costo_total ?? 0), 0)
            const pct = ((cdo + mod) / o.presupuesto * 100).toFixed(0)
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
                  <span className="num text-xs font-medium" style={{ color: 'var(--red)' }}>{pct}% de venta</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {can('verIngresos') && (
          <StatCard icon={TrendingUp}   label="Venta"     value={formatCLP(totalIngresos)} sub="Total facturado"                        accent="emerald" />
        )}
        {can('verCxC') && (
          <StatCard icon={Wallet}       label="Abonos"    value={formatCLP(totalAbonos)}   sub="Cobrado de clientes"                    accent="violet" />
        )}
        {can('verMargen') && (
          <div className="card p-5 flex flex-col group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--border-light)]">
            <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 12px var(--red-dim)' }} />
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'var(--red-dim)' }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 border" style={{ background: 'var(--red-dim)', borderColor: 'rgba(255,69,96,0.3)' }}>
              <TrendingDown size={16} style={{ color: 'var(--red)' }} />
            </div>
            <div className="num font-mono font-medium text-2xl leading-none mb-1.5" style={{ color: 'var(--red)' }}>{formatCLP(egresos)}</div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--muted)' }}>Egresos</p>
            <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex justify-between">
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>CDO</span>
                <span className="num text-[11px] font-medium" style={{ color: 'var(--text)' }}>{formatCLP(gastosCDO)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>GAV</span>
                <span className="num text-[11px] font-medium" style={{ color: 'var(--text)' }}>{formatCLP(gastosGAV)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>MOD</span>
                <span className="num text-[11px] font-medium" style={{ color: 'var(--text)' }}>{formatCLP(totalManoObra)}</span>
              </div>
            </div>
          </div>
        )}
        {can('verMargen') && (
          <StatCard icon={DollarSign}   label="Utilidad"    value={formatCLP(utilidad)}        sub={`${pctUtilidad}% sobre venta`}            accent={parseFloat(pctUtilidad) >= 15 ? 'emerald' : parseFloat(pctUtilidad) >= 0 ? 'amber' : 'red'} />
        )}
        {can('verMargen') && (
          <StatCard icon={Percent}      label="% Utilidad"  value={`${pctUtilidad}%`}          sub={utilidad >= 0 ? 'Utilidad empresa' : 'En pérdida'} accent={parseFloat(pctUtilidad) >= 15 ? 'emerald' : parseFloat(pctUtilidad) >= 0 ? 'amber' : 'red'} />
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
              Venta
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)', boxShadow: '0 0 6px var(--red-dim)' }} />
              Egresos
            </div>
          </div>
        </div>

        {/* Distribución gastos */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="section-title mb-5">Egresos por Categoría</h2>
          {gastosCat.length === 0 ? (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin egresos registrados</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Total Egresos</p>
            <p className="num text-xl font-medium" style={{ color: 'var(--text)' }}>{formatCLP(egresos)}</p>
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
              const cdo = gastos.filter(g => g.project_id === o.id && CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra').reduce((s, g) => s + (g.monto ?? 0), 0)
              const mod = asistencia.filter(a => a.project_id === o.id).reduce((s, a) => s + (a.costo_total ?? 0), 0)
              const g = cdo + mod
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
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{o.presupuesto ? `de ${formatCLP(o.presupuesto)}` : 'sin venta'}</p>
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
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Últimos egresos</span>
      </div>

      {/* ── Últimos gastos ───────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Últimos Egresos</h2>
          <button onClick={() => navigate('/gastos/nuevo')} className="btn-ghost text-[12px]" style={{ color: 'var(--amber)' }}>
            <Plus size={13} /> Subir
          </button>
        </div>
        {ultimosGastos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>No hay egresos registrados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['Proveedor / Categoría', 'Obra', 'Monto', 'Fecha', ''].map(h => (
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
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); openEditGasto(g) }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--amber)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDelGasto(g) }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,69,96,0.08)'; e.currentTarget.style.color = 'var(--red)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit Gasto Modal ─────────────────────── */}
      {editGasto && (
        <Modal open onClose={() => setEditGasto(null)}>
          <div className="p-6 space-y-4" style={{ minWidth: 340 }}>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-base" style={{ color: 'var(--text)' }}>Editar Egreso</h2>
              <button onClick={() => setEditGasto(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Monto</label>
                <input type="number" className="input w-full" value={editGastoForm.monto} onChange={e => setEditGastoForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="select w-full" value={editGastoForm.categoria} onChange={e => setEditGastoForm(f => ({ ...f, categoria: e.target.value }))}>
                  {Object.entries(CATEGORIAS_GASTO).filter(([, v]) => v.grupo !== 'auto').map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Proveedor</label>
                <input type="text" className="input w-full" value={editGastoForm.proveedor} onChange={e => setEditGastoForm(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input w-full" value={editGastoForm.fecha} onChange={e => setEditGastoForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="label">Medio de pago</label>
                <div className="flex gap-2">
                  {['contado', 'credito'].map(mp => (
                    <button
                      key={mp}
                      onClick={() => setEditGastoForm(f => ({ ...f, medio_pago: mp }))}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold capitalize transition-all"
                      style={{
                        background: editGastoForm.medio_pago === mp ? 'var(--amber)' : 'var(--bg-surface)',
                        color: editGastoForm.medio_pago === mp ? '#000' : 'var(--muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {mp}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Comentario</label>
                <input type="text" className="input w-full" value={editGastoForm.comentario} onChange={e => setEditGastoForm(f => ({ ...f, comentario: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            {editGastoError && (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--red)' }}>
                <AlertCircle size={13} /> {editGastoError}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditGasto(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSaveGasto} disabled={editGastoSaving} className="btn-primary flex-1">
                {editGastoSaving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Confirm Delete Gasto Modal ───────────── */}
      {confirmDelGasto && (
        <Modal open onClose={() => setConfirmDelGasto(null)}>
          <div className="p-6 space-y-4" style={{ maxWidth: 320 }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,69,96,0.1)' }}>
              <Trash2 size={18} style={{ color: 'var(--red)' }} />
            </div>
            <div>
              <h2 className="font-display font-bold text-base mb-1" style={{ color: 'var(--text)' }}>Eliminar egreso</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                ¿Eliminar <strong style={{ color: 'var(--text)' }}>{confirmDelGasto.proveedor}</strong> por {formatCLP(confirmDelGasto.monto)}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelGasto(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => handleDeleteGasto(confirmDelGasto.id)}
                disabled={deletingGasto}
                className="flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: 'var(--red)', color: '#fff', opacity: deletingGasto ? 0.6 : 1 }}
              >
                {deletingGasto ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
