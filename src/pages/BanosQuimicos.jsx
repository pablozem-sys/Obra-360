import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Droplets, Plus, ChevronDown, ChevronUp, Loader2,
  Trash2, Clock, X, Calendar,
} from 'lucide-react'
import {
  getBanosQuimicos, createBanoQuimico, updateBanoQuimico, deleteBanoQuimico,
  getPagosBano, createPagoBano, deletePagoBano,
  getProjectsList,
} from '../lib/supabase'
import { formatCLP } from '../lib/helpers'

const ESTADO_META = {
  activo:   { label: 'Activo',    color: 'var(--green)',  bg: 'var(--green-dim)',   border: 'rgba(0,196,140,0.3)' },
  retirado: { label: 'Retirado',  color: 'var(--muted)', bg: 'var(--bg-elevated)', border: 'var(--border)' },
}

const PAGADO_META = {
  si:  { label: 'Pagado',    color: 'var(--green)',  bg: 'var(--green-dim)',  border: 'rgba(0,196,140,0.3)' },
  no:  { label: 'Pendiente', color: 'var(--amber)',  bg: 'var(--amber-dim)',  border: 'rgba(255,149,0,0.3)' },
}

function formatFecha(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function ModalRetiro({ bano, onClose, onConfirm }) {
  const [fechaSalida, setFechaSalida] = useState('')
  const [saving, setSaving] = useState(false)

  const calc = (() => {
    if (!fechaSalida || !bano.fecha_entrada) return null
    const entrada = new Date(bano.fecha_entrada)
    const salida = new Date(fechaSalida)
    const dias = Math.round((salida - entrada) / (1000 * 60 * 60 * 24))
    if (dias < 0) return null
    const costoTotal = Math.round((dias / 30) * bano.monto_mensual)
    const saldo = Math.max(0, costoTotal - bano.monto_mensual)
    return { dias, costoTotal, saldo }
  })()

  const handleConfirm = async () => {
    if (!fechaSalida) return
    setSaving(true)
    try {
      await onConfirm(bano.id, { fecha_salida: fechaSalida, estado: 'retirado' })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>Retiro de Baño Químico</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {bano.proveedor} · {bano.projects?.nombre ?? 'Sin obra'} · Entrada: {formatFecha(bano.fecha_entrada)}
        </p>

        <div>
          <label className="label">Fecha de retiro *</label>
          <input type="date" className="input w-full" value={fechaSalida}
            min={bano.fecha_entrada}
            onChange={e => setFechaSalida(e.target.value)} />
        </div>

        {calc && (
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>Días en obra</span>
              <span className="num font-semibold" style={{ color: 'var(--text)' }}>{calc.dias} días</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
              <span>Costo proporcional</span>
              <span className="num font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(calc.costoTotal)}</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span>Mes prepagado</span>
              <span className="num font-semibold" style={{ color: 'var(--red)' }}>− {formatCLP(bano.monto_mensual)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: 'var(--text)' }}>Saldo a pagar</span>
              <span className="num" style={{ color: calc.saldo > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {calc.saldo > 0 ? formatCLP(calc.saldo) : 'Sin saldo'}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={saving || !fechaSalida || !calc}
            className="btn-primary flex-1 justify-center"
            style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Retiro'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModalBano({ obras, onClose, onSave, initial }) {
  const [form, setForm] = useState({
    proveedor:    initial?.proveedor    ?? 'Portolet',
    project_id:   initial?.project_id  ?? '',
    fecha_entrada: initial?.fecha_entrada ?? '',
    fecha_salida:  initial?.fecha_salida  ?? '',
    monto_mensual: initial?.monto_mensual ?? '',
    notas:         initial?.notas         ?? '',
    estado:        initial?.estado        ?? 'activo',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.fecha_entrada || !form.monto_mensual) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        project_id:    form.project_id    || null,
        monto_mensual: Number(form.monto_mensual),
        fecha_salida:  form.fecha_salida  || null,
        notas:         form.notas         || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>
            {initial ? 'Editar Baño' : 'Agregar Baño Químico'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Proveedor</label>
            <input className="input w-full" value={form.proveedor}
              onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
          </div>
          <div>
            <label className="label">Obra</label>
            <select className="select w-full" value={form.project_id}
              onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
              <option value="">Sin obra asignada</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha entrada *</label>
              <input type="date" className="input w-full" value={form.fecha_entrada}
                onChange={e => setForm(f => ({ ...f, fecha_entrada: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha salida</label>
              <input type="date" className="input w-full" value={form.fecha_salida}
                onChange={e => setForm(f => ({ ...f, fecha_salida: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Monto mensual *</label>
            <input type="number" className="input w-full" placeholder="0" value={form.monto_mensual}
              onChange={e => setForm(f => ({ ...f, monto_mensual: e.target.value }))} />
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="select w-full" value={form.estado}
              onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
              <option value="activo">Activo</option>
              <option value="retirado">Retirado</option>
            </select>
          </div>
          <div>
            <label className="label">Notas</label>
            <input className="input w-full" placeholder="Opcional" value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.fecha_entrada || !form.monto_mensual}
            className="btn-primary flex-1 justify-center"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModalPago({ bano, onClose, onSave }) {
  const [form, setForm] = useState({ fecha_pago: '', monto: bano.monto_mensual ?? '', descripcion: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.fecha_pago || !form.monto) return
    setSaving(true)
    try {
      await onSave({ bano_id: bano.id, ...form, monto: Number(form.monto), descripcion: form.descripcion || null })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>Registrar Pago</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {bano.proveedor} · {bano.projects?.nombre ?? 'Sin obra'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">Fecha de pago *</label>
            <input type="date" className="input w-full" value={form.fecha_pago}
              onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} />
          </div>
          <div>
            <label className="label">Monto *</label>
            <input type="number" className="input w-full" value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <input className="input w-full" placeholder="Ej: Abono mes 1" value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.fecha_pago || !form.monto}
            className="btn-primary flex-1 justify-center"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function BanosQuimicos() {
  const [banos, setBanos]               = useState([])
  const [obras, setObras]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtro, setFiltro]             = useState('todos')
  const [expanded, setExpanded]         = useState(null)
  const [pagos, setPagos]               = useState({})
  const [loadingPagos, setLoadingPagos] = useState({})
  const [showModal, setShowModal]       = useState(false)
  const [editBano, setEditBano]         = useState(null)
  const [pagoModal, setPagoModal]       = useState(null)
  const [toggling, setToggling]         = useState(null)
  const [retiroModal, setRetiroModal]   = useState(null)

  useEffect(() => {
    Promise.all([getBanosQuimicos(), getProjectsList()])
      .then(([b, o]) => { setBanos(b); setObras(o) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!pagos[id]) {
      setLoadingPagos(p => ({ ...p, [id]: true }))
      try {
        const data = await getPagosBano(id)
        setPagos(p => ({ ...p, [id]: data }))
      } finally {
        setLoadingPagos(p => ({ ...p, [id]: false }))
      }
    }
  }

  const handleSaveBano = async (data) => {
    if (editBano) {
      const updated = await updateBanoQuimico(editBano.id, data)
      setBanos(prev => prev.map(b => b.id === editBano.id ? updated : b))
    } else {
      const created = await createBanoQuimico(data)
      setBanos(prev => [created, ...prev])
    }
    setEditBano(null)
  }

  const handleTogglePagado = async (bano) => {
    setToggling(bano.id)
    try {
      const updated = await updateBanoQuimico(bano.id, { pagado: !bano.pagado })
      setBanos(prev => prev.map(b => b.id === bano.id ? updated : b))
    } finally {
      setToggling(null)
    }
  }

  const handleSavePago = async (data) => {
    const nuevo = await createPagoBano(data)
    setPagos(p => ({ ...p, [data.bano_id]: [nuevo, ...(p[data.bano_id] ?? [])] }))
  }

  const handleDeletePago = async (banoId, pagoId) => {
    await deletePagoBano(pagoId)
    setPagos(p => ({ ...p, [banoId]: p[banoId].filter(x => x.id !== pagoId) }))
  }

  const handleRetiro = async (id, updates) => {
    const updated = await updateBanoQuimico(id, updates)
    setBanos(prev => prev.map(b => b.id === id ? updated : b))
    if (expanded === id) setExpanded(null)
  }

  const handleDeleteBano = async (id) => {
    await deleteBanoQuimico(id)
    setBanos(prev => prev.filter(b => b.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const filtered     = filtro === 'todos' ? banos : banos.filter(b => b.estado === filtro)
  const activos      = banos.filter(b => b.estado === 'activo')
  const pendientes   = activos.filter(b => !b.pagado)
  const totalMensual = activos.reduce((s, b) => s + (b.monto_mensual ?? 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Baños Químicos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Arriendos activos y registro de pagos</p>
        </div>
        <button onClick={() => { setEditBano(null); setShowModal(true) }} className="btn-primary">
          <Plus size={14} strokeWidth={2.5} /> Agregar
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Droplets size={13} style={{ color: 'var(--green)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Activos</span>
          </div>
          <p className="font-display font-bold text-2xl num" style={{ color: 'var(--text)' }}>{activos.length}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>baños en obra</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Pendientes</span>
          </div>
          <p className="font-display font-bold text-2xl num"
            style={{ color: pendientes.length > 0 ? 'var(--amber)' : 'var(--text)' }}>
            {pendientes.length}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>sin pagar</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Mensual</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--amber)' }}>
            {formatCLP(totalMensual)}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>costo total mes</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'todos',    label: 'Todos' },
          { key: 'activo',   label: 'Activos' },
          { key: 'retirado', label: 'Retirados' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFiltro(key)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              background: filtro === key ? 'var(--amber)' : 'var(--bg-card)',
              color:  filtro === key ? '#0A0C1A' : 'var(--muted)',
              border: `1px solid ${filtro === key ? 'transparent' : 'var(--border)'}`,
              fontFamily: 'Unbounded',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-sm" style={{ color: 'var(--subtle)' }}>
            Sin baños para este filtro
          </div>
        )}

        {filtered.map(bano => {
          const isExpanded = expanded === bano.id
          const estadoM = ESTADO_META[bano.estado] ?? ESTADO_META.activo
          const pagadoM = PAGADO_META[bano.pagado ? 'si' : 'no']
          const bPagos  = pagos[bano.id] ?? []
          const totalPagado = bPagos.reduce((s, p) => s + (p.monto ?? 0), 0)

          return (
            <div key={bano.id} className="card overflow-hidden"
              style={{ border: isExpanded ? '1px solid rgba(255,149,0,0.2)' : undefined }}>

              {/* Fila principal */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                style={{ background: isExpanded ? 'var(--bg-elevated)' : undefined }}
                onClick={() => toggleExpand(bano.id)}
              >
                {/* Proveedor + Obra */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{bano.proveedor}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {bano.projects?.nombre ?? 'Sin obra asignada'}
                    {bano.notas ? ` · ${bano.notas}` : ''}
                  </p>
                </div>

                {/* Fechas */}
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>
                    Entrada: <span style={{ color: 'var(--text)' }}>{formatFecha(bano.fecha_entrada)}</span>
                  </span>
                  <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>
                    Salida:{' '}
                    <span style={{ color: bano.fecha_salida ? 'var(--text)' : 'var(--subtle)' }}>
                      {formatFecha(bano.fecha_salida)}
                    </span>
                  </span>
                </div>

                {/* Mensual */}
                <div className="text-right hidden md:block">
                  <p className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {formatCLP(bano.monto_mensual)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--muted)' }}>/ mes</p>
                </div>

                {/* Badge estado */}
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold hidden sm:inline-block"
                  style={{ fontFamily: 'Unbounded', background: estadoM.bg, color: estadoM.color, border: `1px solid ${estadoM.border}` }}>
                  {estadoM.label}
                </span>

                {/* Toggle pagado */}
                <button
                  onClick={e => { e.stopPropagation(); handleTogglePagado(bano) }}
                  disabled={toggling === bano.id}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                  style={{ fontFamily: 'Unbounded', background: pagadoM.bg, color: pagadoM.color, border: `1px solid ${pagadoM.border}` }}>
                  {toggling === bano.id ? '...' : pagadoM.label}
                </button>

                <div style={{ color: 'var(--subtle)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </div>

              {/* Panel expandido: historial de pagos */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                  <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>
                        Historial de Pagos
                      </span>
                      {bPagos.length > 0 && (
                        <span className="num text-xs" style={{ color: 'var(--green)' }}>
                          Total: {formatCLP(totalPagado)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPagoModal(bano)} className="btn-secondary py-1.5 px-3"
                        style={{ fontSize: 11 }}>
                        <Plus size={11} /> Pago
                      </button>
                      {bano.estado === 'activo' && (
                        <button
                          onClick={() => setRetiroModal(bano)}
                          className="btn-ghost py-1.5 px-3"
                          style={{ fontSize: 11, color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          Retiro
                        </button>
                      )}
                      <button
                        onClick={() => { setEditBano(bano); setShowModal(true) }}
                        className="btn-ghost py-1.5 px-3"
                        style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteBano(bano.id)}
                        className="btn-ghost py-1.5 px-2"
                        style={{ color: 'var(--red)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {loadingPagos[bano.id] ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }} />
                    </div>
                  ) : bPagos.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--subtle)' }}>
                      Sin pagos registrados — agrega el primer abono
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                            {['Fecha', 'Monto', 'Descripción', ''].map(h => (
                              <th key={h} className="text-left px-5 py-2"
                                style={{ fontSize: 9, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bPagos.map(pago => (
                            <tr key={pago.id} className="table-row">
                              <td className="px-5 py-3">
                                <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                                  {formatFecha(pago.fecha_pago)}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="num text-sm font-semibold" style={{ color: 'var(--green)' }}>
                                  {formatCLP(pago.monto)}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                                  {pago.descripcion ?? '—'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => handleDeletePago(bano.id, pago.id)}
                                  style={{ color: 'var(--subtle)' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--subtle)'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <ModalBano
          obras={obras}
          initial={editBano}
          onClose={() => { setShowModal(false); setEditBano(null) }}
          onSave={handleSaveBano}
        />
      )}

      {pagoModal && (
        <ModalPago
          bano={pagoModal}
          onClose={() => setPagoModal(null)}
          onSave={handleSavePago}
        />
      )}

      {retiroModal && (
        <ModalRetiro
          bano={retiroModal}
          onClose={() => setRetiroModal(null)}
          onConfirm={handleRetiro}
        />
      )}
    </div>
  )
}
