import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, Percent,
  AlertTriangle, Plus, ArrowRight, Wallet, Loader2,
  Pencil, Trash2, X, AlertCircle, HardHat, Building2
} from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import {
  getObras, getObraMetrics, getDashboardKPIs,
  getMesesDisponibles, getUltimosGastos,
  updateGasto, deleteGasto,
} from '../lib/supabase'
import {
  formatCLP, BRAND_NAME,
  ESTADOS_OBRA, TIPOS_OBRA, CATEGORIAS_GASTO
} from '../lib/helpers'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const KPIS_INICIALES = {
  ventaAdicional: 0, totalAbonos: 0, totalManoObra: 0,
  gastosCDO: 0, gastosGAV: 0, totalGastos: 0,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { can } = useAuth()

  const [obras,           setObras]           = useState([])
  const [metricas,        setMetricas]        = useState({})
  const [kpis,            setKpis]            = useState(KPIS_INICIALES)
  const [mesesDisponibles, setMesesDisponibles] = useState([])
  const [ultimosGastos,   setUltimosGastos]   = useState([])
  const [loading,         setLoading]         = useState(true)
  const [loadingKpis,     setLoadingKpis]     = useState(false)

  const [mesFiltro,       setMesFiltro]       = useState(null)

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
      getObraMetrics().catch(() => ({})),
      getMesesDisponibles().catch(() => []),
      getUltimosGastos(6).catch(() => []),
      getDashboardKPIs(null).catch(() => null),
    ]).then(([o, m, meses, ug, k]) => {
      setObras(o)
      setMetricas(m)
      setMesesDisponibles(meses)
      setUltimosGastos(ug)
      if (k) setKpis(k)
    }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  // Refetch de KPIs solo cuando cambia el filtro de mes (no en el mount inicial, ya cubierto arriba)
  const primerRender = useRef(true)
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return }
    setLoadingKpis(true)
    getDashboardKPIs(mesFiltro).catch(() => null).then(k => {
      if (k) setKpis(k)
    }).finally(() => setLoadingKpis(false))
  }, [mesFiltro])

  // Métricas
  const ventaObras      = obras.reduce((s, o) => s + (o.presupuesto ?? 0), 0)
  const totalIngresos   = ventaObras + kpis.ventaAdicional
  const totalManoObra   = kpis.totalManoObra
  const totalAbonos     = kpis.totalAbonos

  const gastosCDO       = kpis.gastosCDO
  const gastosGAV       = kpis.gastosGAV
  const totalGastos     = kpis.totalGastos
  const egresos         = totalGastos + totalManoObra
  const utilidad        = totalIngresos - egresos
  const pctUtilidad     = totalIngresos > 0 ? (utilidad / totalIngresos * 100).toFixed(1) : 0
  const obrasActivas    = obras.filter(o => o.estado === 'en_ejecucion')

  function labelMes(ym) {
    if (!ym) return 'Todo'
    const [y, m] = ym.split('-')
    return `${MESES[parseInt(m) - 1]} ${y}`
  }

  const alertas = obrasActivas.filter(o => {
    const m = metricas[o.id] || { cdo: 0, mod: 0 }
    return o.presupuesto && (m.cdo + m.mod) > o.presupuesto * 0.85
  })

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
      setUltimosGastos(prev => prev.map(g => g.id === editGasto.id ? { ...g, ...updated } : g))
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
      setUltimosGastos(prev => prev.filter(g => g.id !== id))
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
              {BRAND_NAME} // en vivo
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
            const m = metricas[o.id] || { cdo: 0, mod: 0 }
            const pct = ((m.cdo + m.mod) / o.presupuesto * 100).toFixed(0)
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

      {/* ── Selector de mes ──────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[null, ...mesesDisponibles].map(m => (
          <button
            key={m ?? 'todo'}
            onClick={() => setMesFiltro(m)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{
              fontFamily: 'Unbounded',
              background: mesFiltro === m ? 'var(--amber)' : 'var(--bg-surface)',
              color: mesFiltro === m ? '#000' : 'var(--muted)',
              border: `1px solid ${mesFiltro === m ? 'var(--amber)' : 'var(--border)'}`,
            }}
          >
            {labelMes(m)}
          </button>
        ))}
      </div>

      {/* ── Section 01 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>01</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--subtle)', textTransform: 'uppercase' }}>Indicadores</span>
      </div>

      {/* ── Fila 1: Venta · Egresos · Utilidad · % Utilidad ── */}
      {can('verMargen') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ opacity: loadingKpis ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <StatCard icon={TrendingUp}  label="Venta"      value={formatCLP(totalIngresos)} sub={mesFiltro ? 'Presupuestos + adicionales del mes' : 'Total contratado'}  accent="blue" />
          <StatCard icon={TrendingDown} label="Egresos"   value={formatCLP(egresos)}       sub="CDO + MOD + GAV"                                                accent="red" />
          <StatCard icon={DollarSign}  label="Utilidad"   value={formatCLP(utilidad)}      sub={`${pctUtilidad}% sobre venta`}                                  accent={parseFloat(pctUtilidad) >= 20 ? 'emerald' : parseFloat(pctUtilidad) >= 0 ? 'amber' : 'red'} />
          <StatCard icon={Percent}     label="% Utilidad" value={`${pctUtilidad}%`}        sub={utilidad >= 0 ? 'Utilidad empresa' : 'En pérdida'}               accent={parseFloat(pctUtilidad) >= 20 ? 'emerald' : parseFloat(pctUtilidad) >= 0 ? 'amber' : 'red'} />
        </div>
      )}
      {!can('verMargen') && can('verIngresos') && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={TrendingUp} label="Venta" value={formatCLP(totalIngresos)} sub={mesFiltro ? 'Presupuestos + adicionales del mes' : 'Total contratado'} accent="blue" />
        </div>
      )}

      {/* ── Fila 2: Abonos · CDO · MOD · GAV ────── */}
      {can('verMargen') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ opacity: loadingKpis ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          <StatCard icon={Wallet}    label="Abonos"               value={formatCLP(totalAbonos)}  sub="Cobrado de clientes"           accent="emerald" />
          <StatCard icon={HardHat}   label="Costos Directos"      value={formatCLP(gastosCDO)}    sub="CDO — costos de obra"          accent="red" />
          <StatCard icon={TrendingDown} label="Mano de Obra"      value={formatCLP(totalManoObra)} sub="MOD — asistencia"             accent="amber" />
          <StatCard icon={Building2} label="Gastos Empresa"       value={formatCLP(gastosGAV)}    sub="GAV — gastos generales"        accent="violet" />
        </div>
      )}
      {!can('verMargen') && can('verCxC') && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Wallet} label="Abonos" value={formatCLP(totalAbonos)} sub="Cobrado de clientes" accent="emerald" />
        </div>
      )}

      {/* ── Section 02 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>02</span>
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
              const m = metricas[o.id] || { cdo: 0, mod: 0 }
              const g = m.cdo + m.mod
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

      {/* ── Section 03 ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--amber)', minWidth: 18 }}>03</span>
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
                  const obra = g.projects
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
