import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingDown, Loader2, Pencil, Trash2, X, Check } from 'lucide-react'
import { formatCLP, formatDateShort, CATEGORIAS_GASTO } from '../lib/helpers'
import { getGastosDetallado, getProjectsList, updateGasto, deleteGasto, getProviders, upsertProvider } from '../lib/supabase'
import { createPortal } from 'react-dom'

const CATEGORIAS = Object.entries(CATEGORIAS_GASTO)
  .filter(([, v]) => !v.auto)
  .map(([k, v]) => ({ value: k, label: v.label, color: v.color }))

const CATEGORIAS_GRUPOS = Object.entries(CATEGORIAS_GASTO)
  .filter(([, v]) => !v.auto && v.grupo !== undefined)
  .reduce((acc, [k, v]) => {
    const g = v.grupo || 'Otros'
    if (!acc[g]) acc[g] = []
    acc[g].push({ value: k, label: v.label, color: v.color })
    return acc
  }, {})

function EditModal({ gasto, proyectos, onSave, onClose }) {
  const [form, setForm] = useState({
    monto:      String(gasto.monto ?? ''),
    categoria:  gasto.categoria ?? 'materiales',
    proveedor:  gasto.proveedor ?? '',
    fecha:      gasto.fecha ?? '',
    medio_pago: gasto.medio_pago ?? 'contado',
    comentario: gasto.comentario ?? '',
    project_id: gasto.project_id ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [providers, setProviders] = useState([])
  const [provSuggestions, setProvSuggestions] = useState([])
  const [showProvDrop, setShowProvDrop] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => { getProviders().then(setProviders).catch(() => {}) }, [])

  const handleSave = async () => {
    if (!form.monto || !form.proveedor) { setError('Completa monto y proveedor'); return }
    setSaving(true)
    setError('')
    try {
      if (form.proveedor.trim()) {
        try { await upsertProvider(form.proveedor.trim()) } catch { /* no bloquea */ }
      }
      const updated = await updateGasto(gasto.id, {
        monto:      parseInt(form.monto),
        categoria:  form.categoria,
        proveedor:  form.proveedor,
        fecha:      form.fecha,
        medio_pago: form.medio_pago,
        comentario: form.comentario || null,
        project_id: form.project_id || null,
      })
      onSave(updated)
    } catch (e) {
      setError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-display font-bold text-base" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Editar Egreso
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Monto */}
          <div>
            <label className="label">Monto (CLP)</label>
            <input
              type="number"
              className="input num"
              style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500 }}
              placeholder="0"
              value={form.monto}
              onChange={e => set('monto', e.target.value)}
            />
            {form.monto && (
              <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--amber)' }}>
                {formatCLP(parseInt(form.monto))}
              </p>
            )}
          </div>

          {/* Obra */}
          <div>
            <label className="label">Obra</label>
            <select
              className="select"
              value={form.project_id ?? ''}
              onChange={e => set('project_id', e.target.value || null)}
            >
              <option value="">Sin obra (Gasto General)</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="label">Categoría</label>
            <div className="space-y-3 mt-2">
              {Object.entries(CATEGORIAS_GRUPOS).map(([grupo, cats]) => (
                <div key={grupo}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>
                    {grupo}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {cats.map(c => {
                      const active = form.categoria === c.value
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => set('categoria', c.value)}
                          className="p-2.5 rounded-xl text-left transition-all duration-150"
                          style={{
                            background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                            border: `1px solid ${active ? 'var(--border-light)' : 'var(--border)'}`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: c.color, boxShadow: active ? `0 0 6px ${c.color}` : 'none' }}
                            />
                            <span className="text-[12px] font-medium" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                              {c.label}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proveedor */}
          <div className="relative">
            <label className="label">Proveedor</label>
            <input
              className="input"
              placeholder="Nombre del proveedor"
              value={form.proveedor}
              autoComplete="off"
              onChange={e => {
                const v = e.target.value
                set('proveedor', v)
                if (v.length >= 1) {
                  const matches = providers.filter(p => p.nombre.toLowerCase().includes(v.toLowerCase())).slice(0, 6)
                  setProvSuggestions(matches)
                  setShowProvDrop(matches.length > 0)
                } else {
                  setShowProvDrop(false)
                }
              }}
              onBlur={() => setTimeout(() => setShowProvDrop(false), 150)}
            />
            {showProvDrop && (
              <div
                className="absolute left-0 right-0 z-20 rounded-xl overflow-hidden shadow-2xl mt-1"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
              >
                {provSuggestions.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => { set('proveedor', p.nombre); setShowProvDrop(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>

          {/* Medio de pago */}
          <div>
            <label className="label">Medio de pago</label>
            <div className="flex gap-2 mt-2">
              {[{ value: 'contado', label: 'Al Contado' }, { value: 'credito', label: 'Crédito' }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('medio_pago', opt.value)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                  style={{
                    background: form.medio_pago === opt.value ? 'var(--amber)' : 'var(--bg-surface)',
                    color:      form.medio_pago === opt.value ? '#000' : 'var(--muted)',
                    border:     `1px solid ${form.medio_pago === opt.value ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comentario */}
          <div>
            <label className="label">Comentario</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Descripción del egreso..."
              value={form.comentario}
              onChange={e => set('comentario', e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[11px]" style={{ color: 'var(--red)', fontFamily: 'DM Mono' }}>⚠ {error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 justify-center disabled:opacity-70"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Gastos() {
  const navigate = useNavigate()

  const [gastos,    setGastos]    = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading,   setLoading]   = useState(true)

  const [filtroObra,   setFiltroObra]   = useState('all')
  const [filtroDesde,  setFiltroDesde]  = useState('')
  const [filtroHasta,  setFiltroHasta]  = useState('')

  const [editando,    setEditando]    = useState(null)   // gasto completo
  const [confirmDel,  setConfirmDel]  = useState(null)   // id del gasto a eliminar
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => {
    Promise.all([
      getGastosDetallado(),
      getProjectsList(),
    ]).then(([g, p]) => {
      setGastos(g)
      setProyectos(p)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = gastos.filter(g => {
    if (filtroObra !== 'all' && g.project_id !== filtroObra) return false
    if (filtroDesde && g.fecha < filtroDesde) return false
    if (filtroHasta && g.fecha > filtroHasta) return false
    return true
  })

  const total = filtered.reduce((s, g) => s + (g.monto ?? 0), 0)

  const porCategoria = Object.entries(CATEGORIAS_GASTO)
    .map(([key, meta]) => {
      const items = filtered.filter(g => g.categoria === key)
      const monto = items.reduce((s, g) => s + (g.monto ?? 0), 0)
      return { key, ...meta, monto, count: items.length }
    })
    .filter(c => c.monto > 0)
    .sort((a, b) => b.monto - a.monto)

  const maxMonto  = porCategoria[0]?.monto ?? 1
  const hayFiltro = filtroObra !== 'all' || filtroDesde || filtroHasta

  const handleSaved = (updated) => {
    setGastos(prev => prev.map(g => g.id === updated.id
      ? { ...g, ...updated, projects: proyectos.find(p => p.id === updated.project_id) ? { nombre: proyectos.find(p => p.id === updated.project_id).nombre } : g.projects }
      : g
    ))
    setEditando(null)
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await deleteGasto(id)
      setGastos(prev => prev.filter(g => g.id !== id))
      setConfirmDel(null)
    } catch { /* silencioso */ } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
            Egresos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Desglose por categoría y obra
          </p>
        </div>
        <button
          onClick={() => navigate('/gastos/nuevo')}
          className="btn-primary gap-1.5 text-xs"
          style={{ padding: '8px 14px' }}
        >
          <Plus size={13} /> Nuevo egreso
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="select flex-1 min-w-[160px] max-w-[220px]"
          value={filtroObra}
          onChange={e => setFiltroObra(e.target.value)}
        >
          <option value="all">Todas las obras</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input
          type="date" className="input"
          value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <input
          type="date" className="input"
          value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
          style={{ maxWidth: 160 }}
        />
        {hayFiltro && (
          <button
            onClick={() => { setFiltroObra('all'); setFiltroDesde(''); setFiltroHasta('') }}
            className="btn-ghost text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={13} style={{ color: 'var(--red)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
              Total egresos
            </span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--text)' }}>{formatCLP(total)}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{filtered.length} registros</p>
        </div>

        {porCategoria.slice(0, 2).map(c => (
          <div key={c.key} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest truncate" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
                {c.label}
              </span>
            </div>
            <p className="num font-medium text-xl" style={{ color: 'var(--text)' }}>{formatCLP(c.monto)}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
              {total > 0 ? Math.round(c.monto / total * 100) : 0}% del total
            </p>
          </div>
        ))}
      </div>

      {/* Desglose por categoría */}
      <div className="card p-5">
        <h2 className="section-title mb-5">Desglose por categoría</h2>
        {porCategoria.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
            Sin egresos para este período
          </p>
        ) : (
          <div className="space-y-4">
            {porCategoria.map(c => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>{c.count} reg.</span>
                  </div>
                  <div className="text-right flex items-baseline gap-2">
                    <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>
                      {total > 0 ? Math.round(c.monto / total * 100) : 0}%
                    </span>
                    <span className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {formatCLP(c.monto)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(c.monto / maxMonto) * 100}%`,
                      background: c.color,
                      boxShadow: `0 0 8px ${c.color}60`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Registros ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Fecha', 'Obra', 'Proveedor', 'Categoría', 'Monto', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left"
                    style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const cat      = CATEGORIAS_GASTO[g.categoria]
                const isDelConf = confirmDel === g.id
                return (
                  <tr
                    key={g.id}
                    className="table-row group"
                    style={{ background: isDelConf ? 'rgba(255,69,96,0.05)' : undefined }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                        {formatDateShort(g.fecha)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] truncate block max-w-[120px]" style={{ color: 'var(--muted)' }}>
                        {g.projects?.nombre ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {g.proveedor ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat?.color ?? 'var(--subtle)' }} />
                        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{cat?.label ?? g.categoria}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {formatCLP(g.monto)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isDelConf ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]" style={{ color: 'var(--red)', fontFamily: 'DM Mono' }}>¿Eliminar?</span>
                          <button
                            onClick={() => handleDelete(g.id)}
                            disabled={deleting}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
                            style={{ background: 'var(--red)', color: '#fff', opacity: deleting ? 0.6 : 1 }}
                          >
                            {deleting ? '...' : 'Sí'}
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--muted)' }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditando(g)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--amber)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmDel(g.id)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,69,96,0.1)'; e.currentTarget.style.color = 'var(--red)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
                    Sin egresos para este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <EditModal
          gasto={editando}
          proyectos={proyectos}
          onSave={handleSaved}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}
