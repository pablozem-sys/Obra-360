import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Loader2, AlertCircle, Trash2, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { formatDate, ESTADOS_COTIZACION } from '../../lib/helpers'
import { getCotizaciones, createCotizacion, crearCotizacionDesdeTemplate, deleteCotizacion } from '../../lib/cotizador/api'

const FORM_INITIAL = {
  cliente_nombre: '', cliente_contacto: '', nombre_obra: '',
  direccion: '', propietario: '', fecha: new Date().toISOString().split('T')[0],
  validez_dias: '30',
}

export default function CotizadorList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_INITIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    getCotizaciones().then(setCotizaciones).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteCotizacion(id)
      setCotizaciones((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const handleCreate = async () => {
    if (!form.cliente_nombre.trim()) { setFormError('Ingresa el nombre del cliente'); return }
    if (!form.nombre_obra.trim()) { setFormError('Ingresa el nombre de la obra'); return }
    setSaving(true)
    setFormError('')
    try {
      const nueva = await createCotizacion({
        cliente_nombre: form.cliente_nombre.trim(),
        cliente_contacto: form.cliente_contacto.trim() || null,
        nombre_obra: form.nombre_obra.trim(),
        direccion: form.direccion.trim() || null,
        propietario: form.propietario.trim() || null,
        fecha: form.fecha,
        validez_dias: parseInt(form.validez_dias) || null,
        created_by: user?.id ?? null,
      })
      await crearCotizacionDesdeTemplate(nueva.id)
      navigate(`/cotizador/${nueva.id}`)
    } catch (err) {
      setFormError(err.message || 'Error al crear la cotización')
    } finally {
      setSaving(false)
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>Cotizador</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{cotizaciones.length} cotizaciones</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError('') }} className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Nueva Cotización</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {cotizaciones.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-medium" style={{ color: 'var(--muted)' }}>Todavía no hay cotizaciones</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cotizaciones.map((c) => {
            const estadoInfo = ESTADOS_COTIZACION[c.estado]
            return (
              <div
                key={c.id}
                className="card-hover p-5 cursor-pointer flex items-center justify-between gap-4"
                onClick={() => navigate(`/cotizador/${c.id}`)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge className={estadoInfo?.color}>{estadoInfo?.label ?? c.estado}</Badge>
                    {c.version_actual > 0 && (
                      <span className="text-[11px]" style={{ color: 'var(--subtle)', fontFamily: 'DM Mono' }}>v{c.version_actual}</span>
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>{c.nombre_obra}</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{c.cliente_nombre}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{formatDate(c.fecha)}</p>
                  {confirmDeleteId === c.id ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px]" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="px-2 py-0.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                        style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                      >
                        {deletingId === c.id ? <Loader2 size={11} className="animate-spin" /> : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id) }}
                      className="p-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      title="Eliminar cotización"
                    >
                      <Trash2 size={13} style={{ color: 'var(--red)' }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="Nueva Cotización" size="lg">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Cliente *</label>
            <input
              className="input"
              placeholder="Nombre del cliente / prospecto"
              value={form.cliente_nombre}
              onChange={e => { setForm(p => ({ ...p, cliente_nombre: e.target.value })); setFormError('') }}
            />
          </div>
          <div>
            <label className="label">Contacto</label>
            <input
              className="input"
              placeholder="Email o teléfono"
              value={form.cliente_contacto}
              onChange={e => setForm(p => ({ ...p, cliente_contacto: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Nombre de la obra *</label>
            <input
              className="input"
              placeholder="Ej: Quillayes 19"
              value={form.nombre_obra}
              onChange={e => { setForm(p => ({ ...p, nombre_obra: e.target.value })); setFormError('') }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input
              className="input"
              placeholder="Calle y número, comuna"
              value={form.direccion}
              onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Propietario</label>
            <input
              className="input"
              value={form.propietario}
              onChange={e => setForm(p => ({ ...p, propietario: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
          </div>
          <div>
            <label className="label">Validez (días)</label>
            <input
              type="number"
              className="input num"
              value={form.validez_dias}
              onChange={e => setForm(p => ({ ...p, validez_dias: e.target.value }))}
            />
          </div>
        </div>

        {formError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)', letterSpacing: '0.06em' }}>
              {formError.toUpperCase()}
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => { setShowForm(false); setFormError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !form.cliente_nombre || !form.nombre_obra}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? 'Cargando plantilla...' : 'Crear Cotización'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
