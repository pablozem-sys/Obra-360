import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Plus, Check, Loader2, X, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { getTareas, createTarea, updateTarea, deleteTarea, getObras } from '../lib/supabase'

const FILTROS = ['todos', 'pendiente', 'finalizado']
const FILTRO_LABELS = { todos: 'Todos', pendiente: 'Pendiente', finalizado: 'Finalizado' }

const STATUS_META = {
  pendiente:  { label: 'Pendiente',  color: 'var(--amber)', bg: 'var(--amber-dim)',  border: 'rgba(255,149,0,0.3)' },
  finalizado: { label: 'Finalizado', color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(0,196,140,0.3)' },
}

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function NuevaTareaModal({ obras, onSave, onClose }) {
  const [tarea, setTarea] = useState('')
  const [obraId, setObraId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!tarea.trim()) { setError('Escribe una tarea'); return }
    setSaving(true)
    setError('')
    try {
      const nueva = await createTarea({ tarea: tarea.trim(), obra_id: obraId || null, status: 'pendiente' })
      onSave(nueva)
    } catch (e) {
      setError(e?.message || 'Error al crear tarea')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
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
            Nueva tarea
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">Tarea</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Describe la tarea..."
              value={tarea}
              onChange={e => setTarea(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div>
            <label className="label">
              Obra
              <span className="ml-1 text-[10px] font-normal normal-case" style={{ color: 'var(--subtle)', fontFamily: 'Instrument Sans' }}>
                (opcional)
              </span>
            </label>
            <select
              className="select"
              value={obraId}
              onChange={e => setObraId(e.target.value)}
            >
              <option value="">Administración</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear tarea'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EditarTareaModal({ tarea, obras, onSave, onClose }) {
  const [texto, setTexto] = useState(tarea.tarea)
  const [obraId, setObraId] = useState(tarea.obra_id ?? '')
  const [status, setStatus] = useState(tarea.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!texto.trim()) { setError('Escribe una tarea'); return }
    setSaving(true)
    setError('')
    const updates = {
      tarea: texto.trim(),
      obra_id: obraId || null,
      status,
      completed_at: status === 'finalizado'
        ? (tarea.status === 'finalizado' ? tarea.completed_at : new Date().toISOString())
        : null,
    }
    try {
      await updateTarea(tarea.id, updates)
      onSave({ ...tarea, ...updates })
    } catch (e) {
      setError(e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
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
            Editar tarea
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">Tarea</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Describe la tarea..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div>
            <label className="label">
              Obra
              <span className="ml-1 text-[10px] font-normal normal-case" style={{ color: 'var(--subtle)', fontFamily: 'Instrument Sans' }}>
                (opcional)
              </span>
            </label>
            <select
              className="select"
              value={obraId}
              onChange={e => setObraId(e.target.value)}
            >
              <option value="">Administración</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Estado</label>
            <div className="flex gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                  style={{
                    fontFamily: 'Unbounded',
                    background: status === key ? meta.bg : 'var(--bg-surface)',
                    color: status === key ? meta.color : 'var(--subtle)',
                    border: `1px solid ${status === key ? meta.border : 'var(--border)'}`,
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Gestion() {
  const [tareas, setTareas] = useState([])
  const [obras, setObras] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarea, setEditTarea] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [actualizando, setActualizando] = useState(null)

  useEffect(() => {
    Promise.all([getTareas(), getObras()])
      .then(([t, o]) => { setTareas(t); setObras(o) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sortTareas = arr => {
    const pendientes = [...arr.filter(t => t.status === 'pendiente')]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const finalizados = [...arr.filter(t => t.status === 'finalizado')]
      .sort((a, b) => new Date(b.completed_at ?? b.created_at) - new Date(a.completed_at ?? a.created_at))
    return [...pendientes, ...finalizados]
  }

  const filtered = sortTareas(
    filtro === 'todos' ? tareas : tareas.filter(t => t.status === filtro)
  )

  const counts = {
    pendiente:  tareas.filter(t => t.status === 'pendiente').length,
    finalizado: tareas.filter(t => t.status === 'finalizado').length,
  }

  const handleNueva = (nueva) => {
    setTareas(prev => [...prev, nueva])
    setModalOpen(false)
  }

  const handleEditar = (updated) => {
    setTareas(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x))
    setEditTarea(null)
  }

  const handleEliminar = async (t) => {
    setEliminando(t.id)
    try {
      await deleteTarea(t.id)
      setTareas(prev => prev.filter(x => x.id !== t.id))
    } catch {}
    setEliminando(null)
    setConfirmDelete(null)
  }

  const toggleStatus = async (t) => {
    setActualizando(t.id)
    const esFinalizado = t.status === 'finalizado'
    const updates = esFinalizado
      ? { status: 'pendiente', completed_at: null }
      : { status: 'finalizado', completed_at: new Date().toISOString() }

    setTareas(prev => prev.map(x => x.id === t.id ? { ...x, ...updates } : x))
    try {
      await updateTarea(t.id, updates)
    } catch {
      setTareas(prev => prev.map(x => x.id === t.id ? { ...x, status: t.status, completed_at: t.completed_at } : x))
    } finally {
      setActualizando(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Control y Gestión</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Tareas pendientes — las más antiguas aparecen primero</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={15} strokeWidth={2.5} />
          Nueva tarea
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
              Pendientes
            </span>
          </div>
          <p className="font-display font-bold text-2xl num" style={{ color: 'var(--amber)' }}>{counts.pendiente}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>tareas por completar</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check size={13} style={{ color: 'var(--green)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
              Completadas
            </span>
          </div>
          <p className="font-display font-bold text-2xl num" style={{ color: 'var(--green)' }}>{counts.finalizado}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>tareas finalizadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5"
            style={{
              background: filtro === f ? 'var(--amber)' : 'var(--bg-card)',
              color:  filtro === f ? '#0A0C1A' : 'var(--muted)',
              border: `1px solid ${filtro === f ? 'transparent' : 'var(--border)'}`,
              fontFamily: 'Unbounded',
            }}
          >
            {FILTRO_LABELS[f]}
            {f !== 'todos' && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[9px]"
                style={{
                  background: filtro === f ? 'rgba(0,0,0,0.15)' : 'var(--bg-surface)',
                  color: filtro === f ? '#0A0C1A' : 'var(--subtle)',
                }}
              >
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Creada', 'Obra', 'Tarea', 'Estado', 'Finalizada', ''].map(h => (
                  <th
                    key={h}
                    className="text-left px-5 py-3"
                    style={{
                      fontSize: 10,
                      fontFamily: 'Unbounded',
                      fontWeight: 600,
                      color: 'var(--subtle)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const meta = STATUS_META[t.status] ?? STATUS_META.pendiente
                const esFinalizado = t.status === 'finalizado'
                return (
                  <tr key={t.id} className="table-row" style={esFinalizado ? { opacity: 0.65 } : {}}>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                        {formatFecha(t.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[12px]" style={{ color: t.projects?.nombre ? 'var(--text)' : 'var(--subtle)' }}>
                        {t.projects?.nombre ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 w-full">
                      <p
                        className="text-sm"
                        style={{
                          color: 'var(--text)',
                          textDecoration: esFinalizado ? 'line-through' : 'none',
                          textDecorationColor: 'var(--subtle)',
                        }}
                      >
                        {t.tarea}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <button
                        onClick={() => toggleStatus(t)}
                        disabled={actualizando === t.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                        style={{
                          fontFamily: 'Unbounded',
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          cursor: 'pointer',
                        }}
                        title={esFinalizado ? 'Marcar como pendiente' : 'Marcar como finalizado'}
                      >
                        {actualizando === t.id
                          ? '...'
                          : esFinalizado
                            ? <><RotateCcw size={9} /> {meta.label}</>
                            : <><Check size={9} /> {meta.label}</>
                        }
                      </button>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="num text-[12px]" style={{ color: t.completed_at ? 'var(--green)' : 'var(--subtle)' }}>
                        {t.completed_at ? formatFecha(t.completed_at) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditTarea(t)}
                          className="btn-ghost p-1.5"
                          style={{ color: 'var(--muted)' }}
                          title="Editar tarea"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(t)}
                          disabled={eliminando === t.id}
                          className="btn-ghost p-1.5 disabled:opacity-50"
                          style={{ color: 'var(--muted)' }}
                          title="Eliminar tarea"
                        >
                          {eliminando === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>
                    {filtro === 'todos'
                      ? 'Sin tareas — crea la primera con el botón de arriba'
                      : `Sin tareas ${FILTRO_LABELS[filtro].toLowerCase()}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <NuevaTareaModal
          obras={obras}
          onSave={handleNueva}
          onClose={() => setModalOpen(false)}
        />
      )}

      {editTarea && (
        <EditarTareaModal
          tarea={editTarea}
          obras={obras}
          onSave={handleEditar}
          onClose={() => setEditTarea(null)}
        />
      )}

      {confirmDelete && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-display font-bold text-base" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                Eliminar tarea
              </h2>
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                ¿Eliminar esta tarea? Esta acción no se puede deshacer.
              </p>
              <p className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: 'var(--text)', background: 'var(--bg-surface)' }}>
                {confirmDelete.tarea}
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => handleEliminar(confirmDelete)}
                  disabled={eliminando === confirmDelete.id}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,80,80,0.3)' }}
                >
                  {eliminando === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
