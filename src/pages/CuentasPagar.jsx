import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Clock, Loader2, CreditCard, Pencil, X, FileText, Upload, ExternalLink } from 'lucide-react'
import { getEgresosCredito, updateGasto, uploadDocumento, getSignedDocUrl } from '../lib/supabase'

async function abrirDocumento(url) {
  try {
    const signed = await getSignedDocUrl(url)
    if (signed) window.open(signed, '_blank', 'noreferrer')
  } catch (err) {
    console.error('Error al generar URL firmada:', err)
  }
}
import { formatCLP, CATEGORIAS_GASTO } from '../lib/helpers'

const PLAZOS = [1, 2, 3, 6, 12]

function calcDefaultFechaVenc(gasto) {
  if (gasto.fecha_vencimiento) return gasto.fecha_vencimiento
  if (!gasto.fecha || !gasto.plazo_credito) return ''
  const [y, m, d] = gasto.fecha.split('-').map(Number)
  const date = new Date(y, m - 1 + gasto.plazo_credito, d)
  return date.toISOString().split('T')[0]
}

function EditModal({ gasto, onSave, onClose }) {
  const [form, setForm] = useState({
    proveedor:         gasto.proveedor ?? '',
    monto:             String(gasto.monto ?? ''),
    plazo_credito:     gasto.plazo_credito ?? 1,
    fecha_vencimiento: calcDefaultFechaVenc(gasto),
  })
  const [archivoFactura, setArchivoFactura] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const fileRef = useRef()
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.monto || !form.proveedor.trim()) { setError('Completa proveedor y monto'); return }
    setSaving(true)
    setError('')
    try {
      let facturaUrl = gasto.documento_url ?? null
      if (archivoFactura) {
        const path = gasto.project_id || 'general'
        const { url } = await uploadDocumento(path, archivoFactura)
        facturaUrl = url
      }
      const updates = {
        proveedor:         form.proveedor.trim(),
        monto:             parseInt(form.monto),
        plazo_credito:     Number(form.plazo_credito),
        fecha_vencimiento: form.fecha_vencimiento || null,
        documento_url:     facturaUrl,
      }
      const updated = await updateGasto(gasto.id, updates)
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
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-display font-bold text-base" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Editar crédito
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">Proveedor</label>
            <input
              className="input"
              placeholder="Nombre del proveedor"
              value={form.proveedor}
              onChange={e => set('proveedor', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Monto (CLP)</label>
            <input
              type="number"
              className="input num"
              style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 500 }}
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

          <div>
            <label className="label">Fecha de vencimiento</label>
            <input
              type="date"
              className="input"
              value={form.fecha_vencimiento}
              onChange={e => set('fecha_vencimiento', e.target.value)}
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--subtle)' }}>
              Sobreescribe el cálculo automático por plazo
            </p>
          </div>

          <div>
            <label className="label">Plazo de crédito</label>
            <div className="flex gap-2 flex-wrap">
              {PLAZOS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('plazo_credito', p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: form.plazo_credito === p ? 'var(--amber)' : 'var(--bg-surface)',
                    color: form.plazo_credito === p ? '#0A0C1A' : 'var(--muted)',
                    border: `1px solid ${form.plazo_credito === p ? 'transparent' : 'var(--border)'}`,
                    fontFamily: 'Unbounded',
                  }}
                >
                  {p === 1 ? '1 mes' : `${p} meses`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Factura</label>
            {gasto.documento_url && !archivoFactura && (
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: 'var(--amber)' }} />
                <button
                  onClick={() => abrirDocumento(gasto.documento_url)}
                  className="text-xs font-medium underline"
                  style={{ color: 'var(--amber)' }}
                >
                  Ver factura adjunta
                </button>
              </div>
            )}
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-light)' }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} style={{ color: 'var(--muted)' }} />
              <span className="text-xs truncate" style={{ color: archivoFactura ? 'var(--text)' : 'var(--muted)' }}>
                {archivoFactura ? archivoFactura.name : 'Adjuntar factura (PDF, imagen)'}
              </span>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => setArchivoFactura(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function getFechaVencFinal(gasto) {
  if (gasto.fecha_vencimiento) {
    const [y, m, d] = gasto.fecha_vencimiento.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  if (!gasto.fecha || !gasto.plazo_credito) return null
  const [y, m, d] = gasto.fecha.split('-').map(Number)
  return new Date(y, m - 1 + gasto.plazo_credito, d)
}

function deriveEstado(gasto, fechaVencimiento) {
  if (gasto.estado === 'pagado') return 'pagado'
  if (!fechaVencimiento) return 'pendiente'
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  if (fechaVencimiento < hoy) return 'vencido'
  const diasRestantes = (fechaVencimiento - hoy) / (1000 * 60 * 60 * 24)
  if (diasRestantes <= 7) return 'proximo'
  return 'pendiente'
}

function formatFecha(date) {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ESTADO_META = {
  pendiente: { label: 'Pendiente',         color: 'var(--amber)',  bg: 'var(--amber-dim)',  border: 'rgba(255,149,0,0.3)' },
  proximo:   { label: 'Próximo a vencer',  color: 'var(--orange)', bg: 'var(--orange-dim)', border: 'rgba(249,115,22,0.3)' },
  vencido:   { label: 'Vencido',           color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(255,69,96,0.3)' },
  pagado:    { label: 'Pagado',            color: 'var(--green)',  bg: 'var(--green-dim)', border: 'rgba(0,196,140,0.3)' },
}

const FILTROS = ['todos', 'pendiente', 'proximo', 'vencido', 'pagado']
const FILTRO_LABELS = { todos: 'Todos', pendiente: 'Pendiente', proximo: 'Próximo', vencido: 'Vencido', pagado: 'Pagado' }

export default function CuentasPagar() {
  const [creditos,  setCreditos]  = useState([])
  const [filtro,    setFiltro]    = useState('todos')
  const [loading,   setLoading]   = useState(true)
  const [marcando,  setMarcando]  = useState(null)
  const [editando,  setEditando]  = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    getEgresosCredito()
      .then(setCreditos)
      .catch(() => setCreditos([]))
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const creditosConEstado = creditos.map(c => {
    const fechaVencimiento = getFechaVencFinal(c)
    return {
      ...c,
      estadoDerived:    deriveEstado(c, fechaVencimiento),
      fechaVencimiento,
    }
  })

  const sortByVenc = arr => [...arr].sort((a, b) => {
    if (!a.fechaVencimiento) return 1
    if (!b.fechaVencimiento) return -1
    return a.fechaVencimiento - b.fechaVencimiento
  })

  const filtered = sortByVenc(
    filtro === 'todos'
      ? creditosConEstado.filter(c => c.estadoDerived !== 'pagado')
      : creditosConEstado.filter(c => c.estadoDerived === filtro)
  )

  const noPagados = creditosConEstado.filter(c => c.estadoDerived !== 'pagado')
  const totalPendiente = noPagados.reduce((s, c) => s + (c.monto ?? 0), 0)

  const proximos4 = sortByVenc(noPagados.filter(c => c.fechaVencimiento)).slice(0, 4)
  const totalProximos4 = proximos4.reduce((s, c) => s + (c.monto ?? 0), 0)

  const totales = {
    vencido: creditosConEstado.filter(c => c.estadoDerived === 'vencido').reduce((s, c) => s + (c.monto ?? 0), 0),
  }

  const handleEditSave = (updated) => {
    setCreditos(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
    setEditando(null)
  }

  const marcarPagado = async (id) => {
    setMarcando(id)
    setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: 'pagado' } : c))
    try {
      await updateGasto(id, { estado: 'pagado' })
    } catch {
      setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: null } : c))
    } finally {
      setMarcando(null)
    }
  }

  const desmarcarPagado = async (id) => {
    setMarcando(id)
    setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: null } : c))
    try {
      await updateGasto(id, { estado: null })
    } catch {
      setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: 'pagado' } : c))
    } finally {
      setMarcando(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Cuentas a Pagar</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Egresos tomados a crédito — vencimientos y estado de pago</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Pendiente</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--amber)' }}>{formatCLP(totalPendiente)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{noPagados.length} por pagar</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={13} style={{ color: 'var(--orange)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Próximos</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--orange)' }}>{formatCLP(totalProximos4)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Siguientes {proximos4.length} pagos</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} style={{ color: 'var(--red)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Vencido</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--red)' }}>{formatCLP(totales.vencido)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{creditosConEstado.filter(c => c.estadoDerived === 'vencido').length} créditos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              background: filtro === f ? 'var(--amber)' : 'var(--bg-card)',
              color:  filtro === f ? '#0A0C1A' : 'var(--muted)',
              border: `1px solid ${filtro === f ? 'transparent' : 'var(--border)'}`,
              fontFamily: 'Unbounded',
            }}
          >
            {FILTRO_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Fecha toma', 'Proveedor / Obra', 'Monto', 'Plazo', 'Vencimiento', 'Factura', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3"
                    style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const est = ESTADO_META[c.estadoDerived] ?? ESTADO_META.pendiente
                const cat = CATEGORIAS_GASTO[c.categoria]
                return (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>{c.fecha ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.proveedor ?? '—'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {c.projects?.nombre ?? 'Sin obra'} · {cat?.label ?? c.categoria}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(c.monto)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                        {c.plazo_credito ? `${c.plazo_credito} ${c.plazo_credito === 1 ? 'mes' : 'meses'}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="num text-[12px] font-medium"
                        style={{ color: c.estadoDerived === 'vencido' ? 'var(--red)' : c.estadoDerived === 'proximo' ? 'var(--orange)' : 'var(--muted)' }}
                      >
                        {formatFecha(c.fechaVencimiento)}
                      </span>
                      {c.fecha_vencimiento && (
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>MANUAL</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.documento_url ? (
                        <button
                          onClick={() => abrirDocumento(c.documento_url)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                          style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}
                        >
                          <FileText size={12} />
                          Ver
                        </button>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ fontFamily: 'Unbounded', background: est.bg, color: est.color, border: `1px solid ${est.border}` }}
                      >
                        {est.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.estadoDerived !== 'pagado' ? (
                          <button
                            onClick={() => marcarPagado(c.id)}
                            disabled={marcando === c.id}
                            className="text-xs font-semibold transition-colors disabled:opacity-50"
                            style={{ color: 'var(--green)', fontFamily: 'Unbounded' }}
                          >
                            {marcando === c.id ? '...' : 'Marcar pagado'}
                          </button>
                        ) : (
                          <button
                            onClick={() => desmarcarPagado(c.id)}
                            disabled={marcando === c.id}
                            className="text-xs font-semibold transition-colors disabled:opacity-50"
                            style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}
                          >
                            {marcando === c.id ? '...' : 'Desmarcar'}
                          </button>
                        )}
                        {c.estadoDerived !== 'pagado' && (
                          <button
                            onClick={() => setEditando(c)}
                            className="flex items-center gap-1 text-xs font-semibold transition-colors"
                            style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}
                          >
                            <Pencil size={11} />
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>
                    Sin créditos para este filtro
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
          onSave={handleEditSave}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  )
}
