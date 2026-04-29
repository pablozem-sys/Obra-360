import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, DollarSign, Plus, X, Check, ToggleLeft, ToggleRight, Loader2, AlertCircle, Pencil, Eye, EyeOff } from 'lucide-react'
import { formatCLP } from '../lib/helpers'
import {
  getAllWorkers,
  createWorker,
  updateWorker,
  getAttendance,
  getProjectsList,
  getObrasActivas,
  getWorkerProjectIds,
  toggleWorkerProject,
  createObra,
  registrarAsistenciaManual,
} from '../lib/supabase'

function formatHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

function initials(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const HOY = new Date().toISOString().split('T')[0]

export default function ControlAsistencia() {
  const [tab, setTab]               = useState('registros') // registros | trabajadores
  const [registros, setRegistros]   = useState([])
  const [workers, setWorkers]       = useState([])
  const [projects, setProjects]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtroObra, setFiltroObra] = useState('all')
  const [filtroFecha, setFiltroFecha] = useState(HOY)

  // Nuevo trabajador
  const [showForm, setShowForm]     = useState(false)
  const [formNombre, setFormNombre] = useState('')
  const [formValor, setFormValor]   = useState('5000')
  const [formPin, setFormPin]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  // PIN inline edit por worker
  const [editingPin, setEditingPin]   = useState(null)
  const [pinValue, setPinValue]       = useState('')
  const [pinSaving, setPinSaving]     = useState(false)
  const [pinError, setPinError]       = useState('')
  const [showPins, setShowPins]       = useState({})

  // Obras asignadas por worker
  const [obrasActivas, setObrasActivas]       = useState([])
  const [expandedObras, setExpandedObras]     = useState(null)  // worker id
  const [workerObras, setWorkerObras]         = useState({})    // { [workerId]: Set<projectId> }
  const [obrasLoading, setObrasLoading]       = useState(false)
  const [obrasToggling, setObrasToggling]     = useState({})

  // Registro manual de asistencia
  const [showManual, setShowManual]           = useState(false)
  const [manualWorker, setManualWorker]       = useState('')
  const [manualObra, setManualObra]           = useState('')
  const [manualFecha, setManualFecha]         = useState(HOY)
  const [manualEntrada, setManualEntrada]     = useState('')
  const [manualSalida, setManualSalida]       = useState('')
  const [manualSaving, setManualSaving]       = useState(false)
  const [manualError, setManualError]         = useState('')

  // Crear nueva obra desde el panel de asignación
  const [newObraWorker, setNewObraWorker]     = useState(null)  // worker id
  const [newObraNombre, setNewObraNombre]     = useState('')
  const [newObraDireccion, setNewObraDireccion] = useState('')
  const [newObraSaving, setNewObraSaving]     = useState(false)

  const loadRegistros = useCallback(async () => {
    try {
      const data = await getAttendance({
        fecha: filtroFecha || undefined,
        projectId: filtroObra !== 'all' ? filtroObra : undefined,
      })
      setRegistros(data)
    } catch { setRegistros([]) }
  }, [filtroFecha, filtroObra])

  const loadWorkers = async () => {
    try { setWorkers(await getAllWorkers()) }
    catch { setWorkers([]) }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000)
    Promise.allSettled([
      loadRegistros(),
      loadWorkers(),
      getProjectsList().then(setProjects).catch(() => setProjects([])),
      getObrasActivas().then(setObrasActivas).catch(() => setObrasActivas([])),
    ]).finally(() => { clearTimeout(timeout); setLoading(false) })
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    if (!loading) loadRegistros()
  }, [filtroFecha, filtroObra])

  // Summary stats
  const enObra     = registros.filter(r => !r.salida).length
  const totalHoras = registros.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0)
  const totalCosto = registros.reduce((s, r) => s + (r.costo_total ?? 0), 0)

  // Costo por proyecto
  const costoPorObra = projects
    .map(p => {
      const regs  = registros.filter(r => r.project_id === p.id && r.costo_total)
      const costo = regs.reduce((s, r) => s + r.costo_total, 0)
      const horas = regs.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0)
      return { ...p, costoManoObra: costo, horasTotales: horas, nRegistros: regs.length }
    })
    .filter(p => p.costoManoObra > 0)

  const handleGuardarManual = async () => {
    if (!manualWorker) { setManualError('Selecciona un trabajador'); return }
    if (!manualObra)   { setManualError('Selecciona una obra'); return }
    if (!manualEntrada) { setManualError('Ingresa la hora de entrada'); return }
    if (manualSalida && manualSalida <= manualEntrada) {
      setManualError('La salida debe ser después de la entrada')
      return
    }
    const worker = workers.find(w => w.id === manualWorker)
    setManualSaving(true)
    setManualError('')
    try {
      await registrarAsistenciaManual({
        workerId:   manualWorker,
        projectId:  manualObra,
        fecha:      manualFecha,
        horaEntrada: manualEntrada,
        horaSalida:  manualSalida || null,
        valorHora:  worker?.valor_hora ?? 5000,
      })
      await loadRegistros()
      setShowManual(false)
      setManualWorker('')
      setManualObra('')
      setManualFecha(HOY)
      setManualEntrada('')
      setManualSalida('')
    } catch (err) {
      setManualError(err.message || 'Error al guardar')
    } finally {
      setManualSaving(false)
    }
  }

  const handleGuardarWorker = async () => {
    if (!formNombre.trim()) { setFormError('Ingresa un nombre'); return }
    const valor = parseInt(formValor)
    if (!valor || valor < 1000) { setFormError('Valor/hora mínimo $1.000'); return }
    if (formPin && !/^\d{4}$/.test(formPin)) { setFormError('PIN debe ser exactamente 4 dígitos'); return }
    if (formPin && workers.some(w => w.pin === formPin)) { setFormError('Ese PIN ya está en uso, elige otro'); return }
    setSaving(true)
    setFormError('')
    try {
      const nuevo = await createWorker({
        nombre:     formNombre.trim(),
        avatar:     initials(formNombre.trim()),
        valor_hora: valor,
        pin:        formPin || null,
        activo:     true,
      })
      setWorkers(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setFormNombre('')
      setFormValor('5000')
      setFormPin('')
      setShowForm(false)
    } catch (err) {
      setFormError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleExpandObras = async (worker) => {
    if (expandedObras === worker.id) { setExpandedObras(null); return }
    setExpandedObras(worker.id)
    if (workerObras[worker.id]) return  // ya cargado
    setObrasLoading(true)
    try {
      const ids = await getWorkerProjectIds(worker.id)
      setWorkerObras(prev => ({ ...prev, [worker.id]: new Set(ids) }))
    } catch { /* silent */ }
    finally { setObrasLoading(false) }
  }

  const handleToggleObra = async (worker, projectId) => {
    const key = `${worker.id}-${projectId}`
    const current = workerObras[worker.id] ?? new Set()
    const assign = !current.has(projectId)
    // Optimistic
    setWorkerObras(prev => {
      const next = new Set(prev[worker.id] ?? [])
      assign ? next.add(projectId) : next.delete(projectId)
      return { ...prev, [worker.id]: next }
    })
    setObrasToggling(prev => ({ ...prev, [key]: true }))
    try {
      await toggleWorkerProject(worker.id, projectId, assign)
    } catch {
      // Revert
      setWorkerObras(prev => {
        const next = new Set(prev[worker.id] ?? [])
        assign ? next.delete(projectId) : next.add(projectId)
        return { ...prev, [worker.id]: next }
      })
    }
    setObrasToggling(prev => ({ ...prev, [key]: false }))
  }

  const handleCrearObra = async (worker) => {
    if (!newObraNombre.trim()) return
    setNewObraSaving(true)
    try {
      const nueva = await createObra({
        nombre:    newObraNombre.trim(),
        direccion: newObraDireccion.trim() || null,
        estado:    'en_ejecucion',
      })
      setObrasActivas(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      await toggleWorkerProject(worker.id, nueva.id, true)
      setWorkerObras(prev => {
        const next = new Set(prev[worker.id] ?? [])
        next.add(nueva.id)
        return { ...prev, [worker.id]: next }
      })
      setNewObraWorker(null)
      setNewObraNombre('')
      setNewObraDireccion('')
    } catch (err) {
      console.error('createObra:', err)
      alert(err.message || 'Error al crear la obra. Revisa los permisos en Supabase.')
    } finally {
      setNewObraSaving(false)
    }
  }

  const handleGuardarPin = async (worker) => {
    if (!/^\d{4}$/.test(pinValue)) return
    const duplicado = workers.find(w => w.id !== worker.id && w.pin === pinValue)
    if (duplicado) { setPinError(`PIN ya usado por ${duplicado.nombre}`); return }
    setPinError('')
    setPinSaving(true)
    try {
      const updated = await updateWorker(worker.id, { pin: pinValue })
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...updated } : w))
      setEditingPin(null)
      setPinValue('')
    } catch { /* silent */ }
    finally { setPinSaving(false) }
  }

  const handleToggleActivo = async (worker) => {
    const optimistic = workers.map(w => w.id === worker.id ? { ...w, activo: !w.activo } : w)
    setWorkers(optimistic)
    try {
      await updateWorker(worker.id, { activo: !worker.activo })
    } catch {
      setWorkers(workers) // revert
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
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
          Control de Asistencia
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Registro y costos de mano de obra automáticos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>En obra ahora</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--amber)' }}>{enObra}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} style={{ color: 'var(--green)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Total horas</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--green)' }}>{totalHoras.toFixed(1)}</p>
        </div>
        <div className="card p-4 col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={13} style={{ color: 'var(--text)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Costo mano de obra</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--text)' }}>{formatCLP(totalCosto)}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>Calculado automáticamente desde asistencia</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {[
          { key: 'registros',    label: 'Registros' },
          { key: 'trabajadores', label: 'Trabajadores' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background:   tab === t.key ? 'var(--amber)' : 'transparent',
              color:        tab === t.key ? '#000' : 'var(--muted)',
              fontFamily:   'Instrument Sans, sans-serif',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: REGISTROS ─────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {/* Filters + botón manual */}
          <div className="flex gap-3 flex-wrap items-center justify-between">
            <div className="flex gap-3 flex-wrap flex-1">
              <select
                className="select flex-1 min-w-[140px] max-w-[200px]"
                value={filtroObra}
                onChange={e => setFiltroObra(e.target.value)}
              >
                <option value="all">Todas las obras</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input
                type="date"
                className="input flex-1 min-w-[140px] max-w-[180px]"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
              />
              {filtroFecha && (
                <button onClick={() => setFiltroFecha('')} className="btn-ghost text-sm" style={{ color: 'var(--muted)' }}>
                  Limpiar
                </button>
              )}
            </div>
            <button
              onClick={() => { setShowManual(f => !f); setManualError('') }}
              className="btn-primary gap-1.5 text-xs flex-shrink-0"
              style={{ padding: '8px 14px' }}
            >
              {showManual ? <X size={13} /> : <Plus size={13} />}
              {showManual ? 'Cancelar' : 'Registrar manual'}
            </button>
          </div>

          {/* Formulario registro manual */}
          {showManual && (
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,149,0,0.25)' }}
            >
              <p style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase' }}>
                // registro manual de asistencia
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="label">Trabajador</label>
                  <select
                    className="select"
                    value={manualWorker}
                    onChange={e => { setManualWorker(e.target.value); setManualError('') }}
                  >
                    <option value="">Seleccionar...</option>
                    {workers.filter(w => w.activo).map(w => (
                      <option key={w.id} value={w.id}>{w.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Obra</label>
                  <select
                    className="select"
                    value={manualObra}
                    onChange={e => { setManualObra(e.target.value); setManualError('') }}
                  >
                    <option value="">Seleccionar...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={manualFecha}
                    onChange={e => { setManualFecha(e.target.value); setManualError('') }}
                  />
                </div>
                <div>
                  <label className="label">Hora entrada</label>
                  <input
                    type="time"
                    step="60"
                    className="input num"
                    value={manualEntrada}
                    onChange={e => { setManualEntrada(e.target.value); setManualError('') }}
                  />
                </div>
                <div>
                  <label className="label">Hora salida <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
                  <input
                    type="time"
                    step="60"
                    className="input num"
                    value={manualSalida}
                    onChange={e => { setManualSalida(e.target.value); setManualError('') }}
                  />
                </div>
                {manualWorker && manualEntrada && manualSalida && manualSalida > manualEntrada && (
                  <div className="flex flex-col justify-end pb-0.5">
                    <label className="label">Costo estimado</label>
                    <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>
                      {formatCLP(
                        Math.round(
                          ((new Date(`${manualFecha}T${manualSalida}`) - new Date(`${manualFecha}T${manualEntrada}`)) / 3600000) *
                          (workers.find(w => w.id === manualWorker)?.valor_hora ?? 5000)
                        )
                      )}
                    </p>
                  </div>
                )}
              </div>
              {manualError && (
                <div className="flex items-center gap-2">
                  <AlertCircle size={12} style={{ color: 'var(--red)' }} />
                  <p style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--red)', letterSpacing: '0.06em' }}>
                    {manualError.toUpperCase()}
                  </p>
                </div>
              )}
              <button
                onClick={handleGuardarManual}
                disabled={manualSaving}
                className="btn-primary gap-1.5 text-xs disabled:opacity-50"
                style={{ padding: '9px 16px' }}
              >
                {manualSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {manualSaving ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          )}

          {/* Records table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="section-title">Registros ({registros.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo'].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => {
                    const abierto = !r.salida
                    return (
                      <tr key={r.id} className="table-row">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                              style={{ background: 'var(--amber)', color: '#000' }}
                            >
                              {r.workers?.avatar}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{r.workers?.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] truncate block max-w-[130px]" style={{ color: 'var(--muted)' }}>{r.projects?.nombre}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>{formatFecha(r.entrada)}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="num text-[13px] font-medium" style={{ color: 'var(--green)' }}>{formatHora(r.entrada)}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {abierto ? (
                            <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}>
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
                              EN OBRA
                            </span>
                          ) : (
                            <span className="num text-[13px] font-medium" style={{ color: 'var(--red)' }}>{formatHora(r.salida)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : 'var(--amber)' }}>
                            {r.horas_trabajadas != null ? `${r.horas_trabajadas}h` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : 'var(--green)' }}>
                            {r.costo_total != null ? formatCLP(r.costo_total) : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {registros.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
                        Sin registros para este filtro
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Costo por obra */}
          {costoPorObra.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title mb-4">Mano de Obra por Obra</h2>
              <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
                Costos calculados automáticamente desde asistencia.
              </p>
              <div className="space-y-3">
                {costoPorObra.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                      <p className="text-[11px] num" style={{ color: 'var(--muted)' }}>
                        {p.horasTotales.toFixed(1)} hrs · {p.nRegistros} turnos
                      </p>
                    </div>
                    <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>
                      {formatCLP(p.costoManoObra)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: TRABAJADORES ──────────────────────────────────── */}
      {tab === 'trabajadores' && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h2 className="section-title">Trabajadores ({workers.length})</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                Solo los activos aparecen en el kiosco de asistencia
              </p>
            </div>
            <button
              onClick={() => { setShowForm(f => !f); setFormError('') }}
              className="btn-primary gap-1.5 text-xs"
              style={{ padding: '8px 14px' }}
            >
              {showForm ? <X size={13} /> : <Plus size={13} />}
              {showForm ? 'Cancelar' : 'Nuevo'}
            </button>
          </div>

          {/* Nuevo trabajador form */}
          {showForm && (
            <div
              className="px-5 py-4 space-y-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            >
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase' }}>
                // nuevo trabajador
              </p>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="label">Nombre completo</label>
                  <input
                    className="input"
                    placeholder="Ej: Jorge Alvarado"
                    value={formNombre}
                    onChange={e => { setFormNombre(e.target.value); setFormError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleGuardarWorker()}
                    autoFocus
                  />
                </div>
                <div className="w-36">
                  <label className="label">Valor hora ($)</label>
                  <input
                    className="input num"
                    type="number"
                    placeholder="5000"
                    value={formValor}
                    onChange={e => { setFormValor(e.target.value); setFormError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleGuardarWorker()}
                  />
                </div>
                <div className="w-28">
                  <label className="label">PIN (4 dígitos)</label>
                  <input
                    className="input num"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={formPin}
                    onChange={e => { setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setFormError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleGuardarWorker()}
                  />
                </div>
              </div>
              {formError && (
                <div className="flex items-center gap-2">
                  <AlertCircle size={12} style={{ color: 'var(--red)' }} />
                  <p style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--red)', letterSpacing: '0.06em' }}>
                    {formError.toUpperCase()}
                  </p>
                </div>
              )}
              <button
                onClick={handleGuardarWorker}
                disabled={saving}
                className="btn-primary gap-1.5 text-xs disabled:opacity-50"
                style={{ padding: '9px 16px' }}
              >
                {saving
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Check size={13} />
                }
                {saving ? 'Guardando...' : 'Guardar trabajador'}
              </button>
            </div>
          )}

          {/* Workers list */}
          {workers.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay trabajadores registrados</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--subtle)' }}>Agrega el primero con el botón "Nuevo"</p>
            </div>
          ) : (
            <div>
              {workers.map(w => (
                <div
                  key={w.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    opacity: w.activo ? 1 : 0.5,
                  }}
                >
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                      style={{
                        background: w.activo ? 'var(--amber)' : 'var(--bg-elevated)',
                        color:      w.activo ? '#000' : 'var(--subtle)',
                        border:     w.activo ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {w.avatar}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{w.nombre}</p>
                      <p className="text-[12px] num" style={{ color: 'var(--muted)' }}>
                        {formatCLP(w.valor_hora)}/hora
                      </p>
                    </div>

                    {/* PIN badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {w.pin ? (
                        <>
                          <span
                            className="num text-[13px] tracking-widest"
                            style={{ color: showPins[w.id] ? 'var(--text)' : 'var(--subtle)' }}
                          >
                            {showPins[w.id] ? w.pin : '••••'}
                          </span>
                          <button
                            onClick={() => setShowPins(s => ({ ...s, [w.id]: !s[w.id] }))}
                            className="p-1 rounded transition-opacity hover:opacity-70"
                            title="Ver/ocultar PIN"
                          >
                            {showPins[w.id]
                              ? <EyeOff size={13} style={{ color: 'var(--subtle)' }} />
                              : <Eye    size={13} style={{ color: 'var(--subtle)' }} />
                            }
                          </button>
                        </>
                      ) : (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                          style={{
                            fontFamily: 'Unbounded',
                            background: 'rgba(255,69,96,0.1)',
                            color: 'var(--red)',
                            border: '1px solid rgba(255,69,96,0.2)',
                          }}
                        >
                          SIN PIN
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setEditingPin(editingPin === w.id ? null : w.id)
                          setPinValue('')
                        }}
                        className="p-1 rounded transition-opacity hover:opacity-70"
                        title="Cambiar PIN"
                      >
                        <Pencil size={13} style={{ color: 'var(--subtle)' }} />
                      </button>
                    </div>

                    {/* Obras asignadas */}
                    <button
                      onClick={() => handleExpandObras(w)}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all flex-shrink-0"
                      style={{
                        fontFamily: 'Unbounded',
                        letterSpacing: '0.06em',
                        background: expandedObras === w.id ? 'var(--amber-dim)' : 'var(--bg-elevated)',
                        color:      expandedObras === w.id ? 'var(--amber)' : 'var(--subtle)',
                        border:     `1px solid ${expandedObras === w.id ? 'rgba(255,149,0,0.3)' : 'var(--border)'}`,
                      }}
                      title="Gestionar obras asignadas"
                    >
                      OBRAS
                    </button>

                    {/* Toggle activo */}
                    <button
                      onClick={() => handleToggleActivo(w)}
                      className="flex-shrink-0 transition-opacity hover:opacity-80"
                      title={w.activo ? 'Desactivar' : 'Activar'}
                    >
                      {w.activo
                        ? <ToggleRight size={26} style={{ color: 'var(--green)' }} />
                        : <ToggleLeft  size={26} style={{ color: 'var(--subtle)' }} />
                      }
                    </button>
                  </div>

                  {/* Obras asignadas panel */}
                  {expandedObras === w.id && (
                    <div
                      className="px-5 pb-4"
                      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', paddingTop: 14 }}
                    >
                      <p style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 10 }}>
                        // obras asignadas — sin asignación ve todas las activas
                      </p>
                      {obrasLoading && !workerObras[w.id] ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }} />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {obrasActivas.length === 0 && newObraWorker !== w.id && (
                            <p className="text-[12px]" style={{ color: 'var(--subtle)' }}>No hay obras activas. Crea una abajo.</p>
                          )}
                          {obrasActivas.map(o => {
                            const assigned = workerObras[w.id]?.has(o.id) ?? false
                            const toggling = obrasToggling[`${w.id}-${o.id}`]
                            return (
                              <button
                                key={o.id}
                                onClick={() => handleToggleObra(w, o.id)}
                                disabled={toggling}
                                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all text-left disabled:opacity-60"
                                style={{
                                  background: assigned ? 'var(--amber-dim)' : 'var(--bg-card)',
                                  border: `1px solid ${assigned ? 'rgba(255,149,0,0.35)' : 'var(--border)'}`,
                                }}
                              >
                                <div
                                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                  style={{
                                    background: assigned ? 'var(--amber)' : 'transparent',
                                    border: `2px solid ${assigned ? 'var(--amber)' : 'var(--border)'}`,
                                  }}
                                >
                                  {assigned && <Check size={10} color="#000" strokeWidth={3} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: assigned ? 'var(--amber)' : 'var(--text)' }}>
                                    {o.nombre}
                                  </p>
                                  {o.direccion && (
                                    <p className="text-[11px] truncate" style={{ color: 'var(--subtle)' }}>{o.direccion}</p>
                                  )}
                                </div>
                                {toggling && <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--amber)' }} />}
                              </button>
                            )
                          })}

                          {/* Inline: nueva obra */}
                          {newObraWorker === w.id ? (
                            <div
                              className="rounded-xl px-4 py-3 space-y-2"
                              style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,149,0,0.35)' }}
                            >
                              <p style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase' }}>
                                // nueva obra
                              </p>
                              <input
                                className="input text-sm"
                                placeholder="Nombre de la obra"
                                value={newObraNombre}
                                onChange={e => setNewObraNombre(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCrearObra(w)}
                                autoFocus
                              />
                              <input
                                className="input text-sm"
                                placeholder="Dirección (opcional)"
                                value={newObraDireccion}
                                onChange={e => setNewObraDireccion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCrearObra(w)}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCrearObra(w)}
                                  disabled={!newObraNombre.trim() || newObraSaving}
                                  className="btn-primary gap-1 text-xs disabled:opacity-40"
                                  style={{ padding: '7px 12px' }}
                                >
                                  {newObraSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  {newObraSaving ? 'Guardando...' : 'Crear y asignar'}
                                </button>
                                <button
                                  onClick={() => { setNewObraWorker(null); setNewObraNombre(''); setNewObraDireccion('') }}
                                  className="btn-ghost text-xs"
                                  style={{ color: 'var(--muted)' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setNewObraWorker(w.id); setNewObraNombre(''); setNewObraDireccion('') }}
                              className="w-full flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all"
                              style={{
                                background: 'transparent',
                                border: '1px dashed var(--border)',
                                color: 'var(--subtle)',
                              }}
                            >
                              <Plus size={13} />
                              <span className="text-[11px] font-semibold" style={{ fontFamily: 'Unbounded', letterSpacing: '0.06em' }}>
                                NUEVA OBRA
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PIN editor inline */}
                  {editingPin === w.id && (
                    <div
                      className="flex items-center gap-3 px-5 pb-4"
                      style={{ marginTop: -4 }}
                    >
                      <span style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.15em', color: 'var(--amber)', textTransform: 'uppercase', flexShrink: 0 }}>
                        Nuevo PIN →
                      </span>
                      <div className="flex flex-col gap-1 flex-1">
                        <input
                          className="input num w-28 text-center"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="••••"
                          value={pinValue}
                          onChange={e => { setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                          onKeyDown={e => { if (e.key === 'Enter') handleGuardarPin(w) }}
                          autoFocus
                          style={{ fontSize: 18, letterSpacing: '0.2em', padding: '8px 12px' }}
                        />
                        {pinError && <p style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'DM Mono' }}>⚠ {pinError}</p>}
                      </div>
                      <button
                        onClick={() => handleGuardarPin(w)}
                        disabled={pinValue.length !== 4 || pinSaving}
                        className="btn-primary gap-1 text-xs disabled:opacity-40"
                        style={{ padding: '8px 12px', flexShrink: 0 }}
                      >
                        {pinSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Guardar
                      </button>
                      <button
                        onClick={() => { setEditingPin(null); setPinValue(''); setPinError('') }}
                        className="btn-ghost text-xs"
                        style={{ color: 'var(--muted)', flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
