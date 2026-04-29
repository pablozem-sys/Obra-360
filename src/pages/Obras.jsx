import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, MapPin, Calendar, Loader2, AlertCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { formatCLP, formatDate, TIPOS_OBRA, ESTADOS_OBRA } from '../lib/helpers'
import { getObras, createObra } from '../lib/supabase'

const FILTROS = [
  { key: 'all',          label: 'Todas' },
  { key: 'en_ejecucion', label: 'En Ejecución' },
  { key: 'cotizada',     label: 'Cotizadas' },
  { key: 'pausada',      label: 'Pausadas' },
  { key: 'finalizada',   label: 'Finalizadas' },
]

const TIPOS = ['piscina', 'quincho', 'ampliacion', 'remodelacion', 'otro']

const FORM_INITIAL = {
  nombre: '', direccion: '', tipo: 'piscina',
  fecha_inicio: '', fecha_termino: '', presupuesto: '',
  estado: 'cotizada', descripcion: '',
}

export default function Obras() {
  const navigate = useNavigate()
  const [obras, setObras]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('all')
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(FORM_INITIAL)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    getObras()
      .then(setObras)
      .catch(() => setObras([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = obras.filter(o => {
    const matchFiltro = filtro === 'all' || o.estado === filtro
    const matchSearch = !search ||
      o.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      o.clients?.nombre?.toLowerCase().includes(search.toLowerCase())
    return matchFiltro && matchSearch
  })

  const handleCreate = async () => {
    if (!form.nombre.trim()) { setFormError('Ingresa el nombre de la obra'); return }
    setSaving(true)
    setFormError('')
    try {
      const nueva = await createObra({
        nombre:        form.nombre.trim(),
        direccion:     form.direccion.trim() || null,
        tipo:          form.tipo,
        estado:        form.estado,
        fecha_inicio:  form.fecha_inicio || null,
        fecha_termino: form.fecha_termino || null,
        presupuesto:   parseInt(form.presupuesto) || null,
        descripcion:   form.descripcion.trim() || null,
      })
      setObras(prev => [nueva, ...prev])
      setShowForm(false)
      setForm(FORM_INITIAL)
    } catch (err) {
      setFormError(err.message || 'Error al guardar la obra')
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>Obras</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{obras.length} proyectos en total</p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError('') }} className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Nueva Obra</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: filtro === f.key ? 'var(--amber)' : 'var(--bg-card)',
                color:      filtro === f.key ? '#000' : 'var(--muted)',
                border:     filtro === f.key ? 'none' : '1px solid var(--border)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 size={32} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-medium" style={{ color: 'var(--muted)' }}>Sin obras para este filtro</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => {
            const estadoInfo = ESTADOS_OBRA[o.estado]
            const tipoInfo   = TIPOS_OBRA[o.tipo]
            return (
              <div
                key={o.id}
                onClick={() => navigate(`/obras/${o.id}`)}
                className="card-hover p-5 cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <Badge className={tipoInfo?.color}>{tipoInfo?.label ?? o.tipo}</Badge>
                  <Badge className={estadoInfo?.color}>{estadoInfo?.label ?? o.estado}</Badge>
                </div>

                <h3 className="font-display font-semibold text-base leading-tight mb-1" style={{ color: 'var(--text)' }}>
                  {o.nombre}
                </h3>
                {o.clients?.nombre && (
                  <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{o.clients.nombre}</p>
                )}

                {o.direccion && (
                  <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--subtle)' }}>
                    <MapPin size={11} />
                    <span className="truncate">{o.direccion}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="num text-sm font-semibold" style={{ color: 'var(--amber)' }}>
                    {o.presupuesto ? formatCLP(o.presupuesto) : '—'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
                    <Calendar size={11} />
                    {formatDate(o.fecha_termino)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva obra */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setFormError('') }} title="Nueva Obra" size="lg">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nombre de la obra *</label>
            <input
              className="input"
              placeholder="Ej: Piscina Las Condes"
              value={form.nombre}
              onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setFormError('') }}
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
            <label className="label">Tipo de obra</label>
            <select className="select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPOS_OBRA[t]?.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado inicial</label>
            <select className="select" value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
              <option value="cotizada">Cotizada</option>
              <option value="en_ejecucion">En ejecución</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
          </div>
          <div>
            <label className="label">Fecha estimada término</label>
            <input type="date" className="input" value={form.fecha_termino} onChange={e => setForm(p => ({ ...p, fecha_termino: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Presupuesto aprobado (CLP)</label>
            <input
              type="number"
              className="input num"
              placeholder="Ej: 25000000"
              value={form.presupuesto}
              onChange={e => setForm(p => ({ ...p, presupuesto: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descripción</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Descripción del trabajo..."
              value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
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
            disabled={saving || !form.nombre}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? 'Guardando...' : 'Crear Obra'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
