import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, MapPin, Loader2, AlertCircle, Trash2, X, FolderOpen, Upload, Check } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { formatCLP, formatDate, TIPOS_OBRA, ESTADOS_OBRA } from '../lib/helpers'
import { getObras, createObra, deleteObra, uploadDocumento, createDocumento, getObraMetrics } from '../lib/supabase'

const FILTROS = [
  { key: 'en_ejecucion', label: 'En Ejecución' },
  { key: 'finalizada',   label: 'Finalizadas' },
  { key: 'all',          label: 'Todas' },
]

const TIPOS = ['piscina', 'quincho', 'ampliacion', 'remodelacion', '360', 'otro']

const FORM_INITIAL = {
  nombre: '', direccion: '', tipo: 'piscina',
  fecha_inicio: '', fecha_termino: '', presupuesto: '',
  estado: 'en_ejecucion', descripcion: '',
}

const TIPOS_DOC_DOC = ['foto', 'contrato', 'cotizacion', 'factura', 'boleta', 'permiso', 'comprobante']

// Días hábiles (lun-vie) entre hoy y la fecha de término — cuánto le queda a
// la obra, no lo que ya transcurrió.
function diasHabilesRestantes(o) {
  if (!o.fecha_termino || o.estado === 'finalizada') return null
  const [yf, mf, df] = o.fecha_termino.split('-').map(Number)
  const fin = new Date(yf, mf - 1, df)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  if (fin <= hoy) return 0
  let dias = 0
  const cur = new Date(hoy)
  while (cur < fin) {
    const diaSemana = cur.getDay()
    if (diaSemana !== 0 && diaSemana !== 6) dias++
    cur.setDate(cur.getDate() + 1)
  }
  return dias
}

export default function Obras() {
  const navigate = useNavigate()
  const docFileRef = useRef()
  const [obras, setObras]       = useState([])
  const [metricas, setMetricas] = useState({})
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('en_ejecucion')
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(FORM_INITIAL)
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Subir documento
  const [showDocModal, setShowDocModal]   = useState(false)
  const [docObraId,    setDocObraId]      = useState(null)
  const [docFile,      setDocFile]        = useState(null)
  const [docFileName,  setDocFileName]    = useState('')
  const [docNombre,    setDocNombre]      = useState('')
  const [docTipo,      setDocTipo]        = useState('foto')
  const [docSaving,    setDocSaving]      = useState(false)
  const [docSaved,     setDocSaved]       = useState(false)
  const [docError,     setDocError]       = useState('')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getObras(),
      getObraMetrics().catch(() => ({})),
    ]).then(([obras, m]) => {
      setObras(obras)
      setMetricas(m)
    }).catch(() => {}).finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const handleDocFile = e => {
    const file = e.target.files?.[0]
    if (file) { setDocFile(file); setDocFileName(file.name); if (!docNombre) setDocNombre(file.name) }
  }

  const handleUploadDoc = async () => {
    if (!docFile) { setDocError('Selecciona un archivo'); return }
    setDocSaving(true); setDocError('')
    try {
      const { url } = await uploadDocumento(docObraId, docFile)
      await createDocumento({
        project_id: docObraId,
        tipo: docTipo,
        nombre: docNombre || docFileName,
        archivo_url: url,
        fecha: new Date().toISOString().split('T')[0],
      })
      setDocSaved(true)
    } catch (err) {
      setDocError(err?.message || 'Error al subir')
    } finally {
      setDocSaving(false)
    }
  }

  const resetDocModal = () => {
    setShowDocModal(false); setDocObraId(null); setDocFile(null)
    setDocFileName(''); setDocNombre(''); setDocTipo('foto')
    setDocError(''); setDocSaved(false)
  }

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

  const handleDelete = async (id) => {
    try {
      await deleteObra(id)
      setObras(prev => prev.filter(o => o.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmDeleteId(null)
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
        <div className="flex flex-col gap-4">
          {filtered.map(o => {
            const estadoInfo = ESTADOS_OBRA[o.estado]
            const tipoInfo   = TIPOS_OBRA[o.tipo]
            const m          = metricas[o.id] || { cdo: 0, mod: 0, adicionales: 0, descuentos: 0, abonos: 0 }
            const ventaTotal = (o.presupuesto || 0) + (m.adicionales - m.descuentos)
            const saldoPendiente = ventaTotal - m.abonos
            const saldoColor = saldoPendiente > 0 ? 'var(--amber)' : saldoPendiente < 0 ? 'var(--red)' : 'var(--green)'
            const diasRestantes = diasHabilesRestantes(o)
            const margenPct  = ventaTotal > 0 ? ((ventaTotal - m.cdo - m.mod) / ventaTotal * 100).toFixed(0) : null
            const margenColor = margenPct === null ? 'var(--subtle)'
              : parseInt(margenPct) >= 20 ? 'var(--green)'
              : parseInt(margenPct) > 0   ? 'var(--amber)'
              : 'var(--red)'
            const labelStyle = { color: 'var(--subtle)', fontFamily: 'Unbounded' }
            return (
              <div
                key={o.id}
                className="card-hover p-5 cursor-pointer group relative flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6"
                onClick={() => navigate(`/obras/${o.id}`)}
              >
                {/* Identidad */}
                <div className="lg:w-56 lg:flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={tipoInfo?.color}>{tipoInfo?.label ?? o.tipo}</Badge>
                    <Badge className={estadoInfo?.color}>{estadoInfo?.label ?? o.estado}</Badge>
                  </div>
                  <h3 className="font-display font-semibold text-base leading-tight mb-1" style={{ color: 'var(--text)' }}>
                    {o.nombre}
                  </h3>
                  {(o.fecha_inicio || o.fecha_termino) && (
                    <p className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>
                      {o.fecha_inicio && <>Inicio {formatDate(o.fecha_inicio)}</>}
                      {o.fecha_inicio && o.fecha_termino && ' · '}
                      {o.fecha_termino && <>Término {formatDate(o.fecha_termino)}</>}
                      {diasRestantes !== null && (
                        <>
                          {' · '}
                          <span style={{
                            fontWeight: 600,
                            color: diasRestantes === 0 ? 'var(--red)' : diasRestantes <= 5 ? 'var(--amber)' : 'var(--text)',
                          }}>
                            {diasRestantes === 0 ? 'Atrasada' : `${diasRestantes} días hábiles restantes`}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {o.clients?.nombre && (
                    <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>{o.clients.nombre}</p>
                  )}
                  {o.direccion && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
                      <MapPin size={11} />
                      <span className="truncate">{o.direccion}</span>
                    </div>
                  )}
                </div>

                {/* Métricas */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 whitespace-nowrap" style={labelStyle}>Venta</p>
                    <p className="num text-sm font-bold" style={{ color: 'var(--blue)' }}>{ventaTotal > 0 ? formatCLP(ventaTotal) : '—'}</p>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 mt-2 whitespace-nowrap" style={labelStyle}>Saldo</p>
                    <p className="num text-sm font-bold" style={{ color: saldoColor }}>{ventaTotal > 0 ? formatCLP(Math.abs(saldoPendiente)) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 whitespace-nowrap" style={labelStyle}>Abonado</p>
                    <p className="num text-[11px] font-semibold" style={{ color: 'var(--green)' }}>{m.abonos > 0 ? formatCLP(m.abonos) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 whitespace-nowrap" style={labelStyle}>CDO</p>
                    <p className="num text-[11px] font-semibold" style={{ color: 'var(--red)' }}>{m.cdo > 0 ? formatCLP(m.cdo) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 whitespace-nowrap" style={labelStyle}>M.O.</p>
                    <p className="num text-[11px] font-semibold" style={{ color: 'var(--amber)' }}>{m.mod > 0 ? formatCLP(m.mod) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest mb-0.5 whitespace-nowrap" style={labelStyle}>% Margen</p>
                    <p className="num text-[11px] font-semibold" style={{ color: margenColor }}>
                      {margenPct !== null ? `${margenPct}%` : '—'}
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center justify-end gap-1.5 pt-3 lg:pt-0 lg:pl-4 lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {confirmDeleteId === o.id ? (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-[11px]" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                      >Sí</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setDocObraId(o.id); setDocSaved(false); setDocError(''); setDocFile(null); setDocFileName(''); setDocNombre(''); setDocTipo('foto'); setShowDocModal(true) }}
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        title="Subir documento"
                      >
                        <FolderOpen size={11} style={{ color: 'var(--amber)' }} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(o.id) }}
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        title="Eliminar obra"
                      >
                        <Trash2 size={11} style={{ color: 'var(--red)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal subir documento */}
      <input type="file" ref={docFileRef} onChange={handleDocFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
      <Modal open={showDocModal} onClose={resetDocModal} title="Subir Documento" size="md">
        {docSaved ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'var(--green-dim)', border: '1px solid rgba(0,196,140,0.3)' }}>
              <Check size={28} style={{ color: 'var(--green)' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Documento subido</p>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>El archivo fue guardado correctamente</p>
            <button onClick={resetDocModal} className="btn-primary justify-center w-full">Cerrar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Tipo de documento</label>
              <select className="select mt-1" value={docTipo} onChange={e => setDocTipo(e.target.value)}>
                {TIPOS_DOC_DOC.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nombre (opcional)</label>
              <input className="input" placeholder="Ej: Contrato firmado" value={docNombre} onChange={e => setDocNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">Archivo</label>
              {docFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl mt-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <span className="text-xl">📎</span>
                  <p className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }}>{docFileName}</p>
                  <button onClick={() => { setDocFile(null); setDocFileName('') }} style={{ color: 'var(--muted)' }}><X size={14} /></button>
                </div>
              ) : (
                <div
                  onClick={() => docFileRef.current?.click()}
                  className="rounded-xl p-6 text-center cursor-pointer mt-1 transition-all"
                  style={{ border: '2px dashed var(--border)', background: 'var(--bg-surface)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,149,0,0.35)'; e.currentTarget.style.background = 'var(--amber-dim)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
                >
                  <Upload size={22} className="mx-auto mb-2" style={{ color: 'var(--subtle)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Seleccionar archivo</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>PDF, imagen, Word, Excel</p>
                </div>
              )}
            </div>
            {docError && <p className="text-[11px]" style={{ color: 'var(--red)', fontFamily: 'DM Mono' }}>⚠ {docError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={resetDocModal} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={handleUploadDoc} disabled={docSaving || !docFile} className="btn-primary flex-1 justify-center disabled:opacity-60">
                {docSaving ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</> : <><Upload size={14} /> Subir</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

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
              <option value="en_ejecucion">En ejecución</option>
              <option value="cotizada">Cotizada</option>
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
            <label className="label">Venta Aprobada (CLP)</label>
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
