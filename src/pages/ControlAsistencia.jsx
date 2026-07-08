import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, DollarSign, Plus, X, Check, ToggleLeft, ToggleRight, Loader2, AlertCircle, AlertTriangle, Pencil, Eye, EyeOff, Hash, Trash2 } from 'lucide-react'
import { formatCLP } from '../lib/helpers'
import { supabase } from '../lib/supabase'
import {
  getAllWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  updateObra,
  getAttendance,
  getProjectsList,
  getObrasActivas,
  getWorkerProjectIds,
  toggleWorkerProject,
  createObra,
  registrarAsistenciaManual,
  actualizarSalidaManual,
  getRegistrosAbiertosAnteriores,
} from '../lib/supabase'

/* ── Time Picker ─────────────────────────────────────────────── */
function TimePicker({ value, onChange }) {
  const parse = (v) => {
    if (!v) return { h: '', m: '' }
    const [hStr, mStr] = v.split(':')
    return { h: hStr ?? '', m: mStr ?? '' }
  }

  const [h, setH] = useState(() => parse(value).h)
  const [m, setM] = useState(() => parse(value).m)

  const build = (hv, mv) => {
    if (hv === '' || mv === '') return ''
    return `${hv.padStart(2, '0')}:${mv.padStart(2, '0')}`
  }

  const handleH = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 2)
    setH(clean)
    const num = parseInt(clean, 10)
    if (clean !== '' && num >= 0 && num <= 23) onChange(build(clean, m))
    else onChange('')
  }
  const handleM = (v) => {
    const clean = v.replace(/\D/g, '').slice(0, 2)
    setM(clean)
    const num = parseInt(clean, 10)
    if (clean !== '' && num >= 0 && num <= 59) onChange(build(h, clean))
    else onChange('')
  }
  const blurH = () => {
    const num = parseInt(h, 10)
    if (h === '' || isNaN(num)) { setH(''); onChange(''); return }
    const clamped = String(Math.min(23, Math.max(0, num))).padStart(2, '0')
    setH(clamped)
    onChange(build(clamped, m))
  }
  const blurM = () => {
    const num = parseInt(m, 10)
    if (m === '' || isNaN(num)) { setM('00'); onChange(build(h, '00')); return }
    const clamped = String(Math.min(59, Math.max(0, num))).padStart(2, '0')
    setM(clamped)
    onChange(build(h, clamped))
  }

  const btn = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontSize: 18,
    fontFamily: 'DM Mono',
    letterSpacing: '0.05em',
    textAlign: 'center',
    borderRadius: 12,
    padding: '8px 4px',
    width: 52,
    outline: 'none',
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text" inputMode="numeric" maxLength={2}
        placeholder="00" value={h}
        onChange={e => handleH(e.target.value)}
        onBlur={blurH}
        style={btn}
      />
      <span style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>:</span>
      <input
        type="text" inputMode="numeric" maxLength={2}
        placeholder="00" value={m}
        onChange={e => handleM(e.target.value)}
        onBlur={blurM}
        style={btn}
      />
    </div>
  )
}

function formatHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
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
  const [tab, setTab]               = useState('registros') // registros | trabajadores | quincena
  const [registros, setRegistros]   = useState([])
  const [workers, setWorkers]       = useState([])
  const [projects, setProjects]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtroObra, setFiltroObra] = useState('all')
  const [filtroFecha, setFiltroFecha] = useState(HOY)
  const [soloAbiertos, setSoloAbiertos] = useState(false)
  const [abiertosAnteriores, setAbiertosAnteriores] = useState([])

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

  // Editar salida de un registro
  const [editingRecord, setEditingRecord]   = useState(null)
  const [editSalida, setEditSalida]         = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')

  // Quincena
  const now = new Date()
  const [quinMes, setQuinMes]       = useState(now.getMonth())
  const [quinAnio, setQuinAnio]     = useState(now.getFullYear())
  const [quinPeriodo, setQuinPeriodo] = useState(now.getDate() <= 15 ? '1' : '2')
  const [quinRegistros, setQuinRegistros] = useState([])
  const [quinLoading, setQuinLoading] = useState(false)

  // Crear nueva obra desde el panel de asignación
  const [newObraWorker, setNewObraWorker]     = useState(null)  // worker id
  const [newObraNombre, setNewObraNombre]     = useState('')
  const [newObraDireccion, setNewObraDireccion] = useState('')
  const [newObraClave, setNewObraClave]       = useState('')
  const [newObraSaving, setNewObraSaving]     = useState(false)

  // Eliminar trabajador
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null)

  // Editar clave de obra existente
  const [editingClave, setEditingClave]   = useState(null)  // obra id
  const [claveValue, setClaveValue]       = useState('')
  const [claveSaving, setClaveSaving]     = useState(false)
  const [claveError, setClaveError]       = useState('')

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
      getRegistrosAbiertosAnteriores().then(setAbiertosAnteriores).catch(() => setAbiertosAnteriores([])),
    ]).finally(() => { clearTimeout(timeout); setLoading(false) })
    return () => clearTimeout(timeout)
  }, [])

  const verAbiertosAnteriores = () => {
    setFiltroFecha('')
    setFiltroObra('all')
    setSoloAbiertos(true)
    setTab('registros')
  }

  useEffect(() => {
    if (!loading) loadRegistros()
  }, [filtroFecha, filtroObra])

  useEffect(() => {
    if (tab !== 'quincena') return
    const mes = quinMes
    const anio = quinAnio
    const diasDesde = quinPeriodo === '1' ? 1 : 16
    const diasHasta = quinPeriodo === '1' ? 15 : new Date(anio, mes + 1, 0).getDate()
    const pad = n => String(n).padStart(2, '0')
    const desde = `${anio}-${pad(mes + 1)}-${pad(diasDesde)}`
    const hasta  = `${anio}-${pad(mes + 1)}-${pad(diasHasta)}`
    setQuinLoading(true)
    supabase
      .from('attendance')
      .select(`id, worker_id, project_id, fecha, horas_trabajadas, valor_hora, costo_total, workers(nombre), projects(nombre)`)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .not('salida', 'is', null)
      .order('fecha', { ascending: true })
      .then(({ data }) => setQuinRegistros(data ?? []))
      .catch(() => setQuinRegistros([]))
      .finally(() => setQuinLoading(false))
  }, [tab, quinMes, quinAnio, quinPeriodo])

  // Summary stats
  const enObra     = registros.filter(r => !r.salida).length
  const totalHoras = registros.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0)
  const totalCosto = registros.reduce((s, r) => s + (r.costo_total ?? 0), 0)
  const registrosVisibles = soloAbiertos ? registros.filter(r => !r.salida) : registros

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

  const handleGuardarSalida = async (record) => {
    if (!editSalida) { setEditError('Ingresa la hora de salida'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await actualizarSalidaManual(
        record.id,
        record.entrada,
        record.fecha,
        editSalida,
        record.valor_hora ?? 5000,
      )
      setRegistros(prev => prev.map(r => r.id === record.id ? { ...r, ...updated } : r))
      setEditingRecord(null)
      setEditSalida('')
    } catch (err) {
      setEditError(err.message || 'Error al guardar')
    } finally {
      setEditSaving(false)
    }
  }

  const handleGuardarWorker = async () => {
    if (!formNombre.trim()) { setFormError('Ingresa un nombre'); return }
    const valor = parseInt(formValor)
    if (!valor || valor < 1000) { setFormError('Valor día mínimo $1.000'); return }
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
        clave:     newObraClave.trim() || null,
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
      setNewObraClave('')
    } catch (err) {
      console.error('createObra:', err)
      alert(err.message || 'Error al crear la obra. Revisa los permisos en Supabase.')
    } finally {
      setNewObraSaving(false)
    }
  }

  const handleGuardarClave = async (obraId) => {
    const val = claveValue.trim()
    if (!val) return
    const duplicada = obrasActivas.find(o => o.id !== obraId && o.clave === val)
    if (duplicada) { setClaveError(`Clave usada en "${duplicada.nombre}"`); return }
    setClaveError('')
    setClaveSaving(true)
    try {
      await updateObra(obraId, { clave: val })
      setObrasActivas(prev => prev.map(o => o.id === obraId ? { ...o, clave: val } : o))
      setEditingClave(null)
      setClaveValue('')
    } catch { /* silent */ }
    finally { setClaveSaving(false) }
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

  const handleDeleteWorker = async (id) => {
    try {
      await deleteWorker(id)
      setWorkers(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmDeleteWorkerId(null)
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
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Total días</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--green)' }}>{(totalHoras / 9).toFixed(2)}</p>
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

      {/* Aviso: registros de días anteriores sin salida marcada */}
      {abiertosAnteriores.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.3)' }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--amber)' }} className="flex-shrink-0" />
          <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
            <span className="font-semibold">{abiertosAnteriores.length}</span>{' '}
            {abiertosAnteriores.length === 1 ? 'registro sin' : 'registros sin'} salida marcada (días anteriores)
          </p>
          <button onClick={verAbiertosAnteriores} className="btn-secondary text-xs flex-shrink-0" style={{ padding: '6px 12px' }}>
            Ver
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {[
          { key: 'registros',    label: 'Registros' },
          { key: 'trabajadores', label: 'Trabajadores' },
          { key: 'quincena',     label: 'Quincena' },
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
              {soloAbiertos && (
                <button
                  onClick={() => setSoloAbiertos(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(255,149,0,0.12)', color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.3)' }}
                >
                  Solo sin cerrar <X size={12} />
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
                  <TimePicker
                    value={manualEntrada}
                    onChange={v => { setManualEntrada(v); setManualError('') }}
                  />
                </div>
                <div>
                  <label className="label">Hora salida <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
                  <TimePicker
                    value={manualSalida}
                    onChange={v => { setManualSalida(v); setManualError('') }}
                  />
                </div>
                {manualWorker && manualEntrada && manualSalida && manualSalida > manualEntrada && (
                  <div className="flex flex-col justify-end pb-0.5">
                    <label className="label">Costo estimado</label>
                    <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>
                      {(() => {
                        const horas = (new Date(`${manualFecha}T${manualSalida}`) - new Date(`${manualFecha}T${manualEntrada}`)) / 3600000
                        const dias = horas / 9
                        const valorDia = workers.find(w => w.id === manualWorker)?.valor_hora ?? 50000
                        return formatCLP(Math.round(dias * valorDia))
                      })()}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--subtle)', fontFamily: 'DM Mono' }}>
                      {((new Date(`${manualFecha}T${manualSalida}`) - new Date(`${manualFecha}T${manualEntrada}`)) / 3600000).toFixed(1)}h = {((new Date(`${manualFecha}T${manualSalida}`) - new Date(`${manualFecha}T${manualEntrada}`)) / 32400000).toFixed(2)} días
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
              <h2 className="section-title">Registros ({registrosVisibles.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                    {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Días', 'Costo', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosVisibles.map(r => {
                    const abierto = !r.salida
                    const isEditing = editingRecord === r.id
                    return (
                      <>
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
                              {r.horas_trabajadas != null ? `${(r.horas_trabajadas / 9).toFixed(2)}d` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : 'var(--green)' }}>
                              {r.costo_total != null ? formatCLP(r.costo_total) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => {
                                if (isEditing) { setEditingRecord(null); setEditSalida(''); setEditError('') }
                                else { setEditingRecord(r.id); setEditSalida(''); setEditError('') }
                              }}
                              title="Ingresar / editar salida"
                              className="p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{
                                background: isEditing ? 'var(--amber-dim)' : 'var(--bg-elevated)',
                                border: `1px solid ${isEditing ? 'rgba(255,149,0,0.4)' : 'var(--border)'}`,
                              }}
                            >
                              <Pencil size={12} style={{ color: isEditing ? 'var(--amber)' : 'var(--subtle)' }} />
                            </button>
                          </td>
                        </tr>
                        {isEditing && (
                          <tr style={{ background: 'var(--bg-surface)' }}>
                            <td colSpan={8} className="px-6 py-4">
                              <div className="flex items-center gap-4 flex-wrap">
                                <p style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase', flexShrink: 0 }}>
                                  // hora de salida — {r.workers?.nombre}
                                </p>
                                <TimePicker value={editSalida} onChange={v => { setEditSalida(v); setEditError('') }} />
                                <button
                                  onClick={() => handleGuardarSalida(r)}
                                  disabled={!editSalida || editSaving}
                                  className="btn-primary gap-1 text-xs disabled:opacity-40"
                                  style={{ padding: '8px 14px', flexShrink: 0 }}
                                >
                                  {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  Guardar salida
                                </button>
                                <button
                                  onClick={() => { setEditingRecord(null); setEditSalida(''); setEditError('') }}
                                  className="btn-ghost text-xs"
                                  style={{ color: 'var(--muted)', flexShrink: 0 }}
                                >
                                  <X size={12} />
                                </button>
                                {editError && (
                                  <p style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'var(--red)' }}>⚠ {editError}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                  {registrosVisibles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
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
                        {(p.horasTotales / 9).toFixed(2)} días · {p.nRegistros} turnos
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

      {/* ── TAB: QUINCENA ─────────────────────────────────────── */}
      {tab === 'quincena' && (() => {
        const MESES_LABELS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const aniosDisp = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

        // Agrupar por obra → trabajador
        const porObra = {}
        quinRegistros.forEach(r => {
          const obraKey  = r.project_id
          const obraNombre = r.projects?.nombre ?? '—'
          if (!porObra[obraKey]) porObra[obraKey] = { nombre: obraNombre, workers: {} }
          const wKey = r.worker_id
          const wNombre = r.workers?.nombre ?? '—'
          if (!porObra[obraKey].workers[wKey]) porObra[obraKey].workers[wKey] = { nombre: wNombre, horas: 0, costo: 0 }
          porObra[obraKey].workers[wKey].horas += r.horas_trabajadas ?? 0
          porObra[obraKey].workers[wKey].costo += r.costo_total ?? 0
        })

        return (
          <div className="space-y-4">
            {/* Selectores */}
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {[{ key: '1', label: '1ra (1–15)' }, { key: '2', label: '2da (16–fin)' }].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setQuinPeriodo(p.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: quinPeriodo === p.key ? 'var(--amber)' : 'transparent',
                      color:      quinPeriodo === p.key ? '#000' : 'var(--muted)',
                      fontFamily: 'Instrument Sans, sans-serif',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <select className="select" value={quinMes} onChange={e => setQuinMes(parseInt(e.target.value))}>
                {MESES_LABELS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select className="select" value={quinAnio} onChange={e => setQuinAnio(parseInt(e.target.value))}>
                {aniosDisp.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {quinLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
              </div>
            ) : Object.keys(porObra).length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin registros para esta quincena</p>
              </div>
            ) : (
              Object.entries(porObra).map(([obraId, obra]) => {
                const workers = Object.values(obra.workers)
                const totalCostoObra = workers.reduce((s, w) => s + w.costo, 0)
                const totalDiasObra  = workers.reduce((s, w) => s + w.horas, 0) / 9

                return (
                  <div key={obraId} className="card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{obra.nombre}</h3>
                        <p className="num text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {totalDiasObra.toFixed(2)} días · {workers.length} trabajadores
                        </p>
                      </div>
                      <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>{formatCLP(totalCostoObra)}</p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Trabajador', 'Días', 'Valor Día', 'Total'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {workers.sort((a, b) => b.costo - a.costo).map(w => {
                          const dias = w.horas / 9
                          const valorDia = dias > 0 ? Math.round(w.costo / dias) : 0
                          return (
                            <tr key={w.nombre} className="table-row">
                              <td className="px-5 py-3">
                                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{w.nombre}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="num text-[13px]" style={{ color: 'var(--amber)' }}>{dias.toFixed(2)}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>{formatCLP(valorDia)}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="num text-[13px] font-semibold" style={{ color: 'var(--green)' }}>{formatCLP(w.costo)}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })
            )}

            {/* Total general quincena */}
            {Object.keys(porObra).length > 0 && !quinLoading && (
              <div
                className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: 'var(--amber-dim)', border: '1px solid rgba(255,149,0,0.25)' }}
              >
                <div>
                  <p style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--amber)', textTransform: 'uppercase', opacity: 0.7 }}>
                    Total quincena
                  </p>
                  <p className="text-[11px] mt-0.5 num" style={{ color: 'var(--muted)' }}>
                    {(quinRegistros.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0) / 9).toFixed(2)} días · {Object.keys(porObra).length} obras
                  </p>
                </div>
                <p className="num font-bold text-xl" style={{ color: 'var(--amber)' }}>
                  {formatCLP(quinRegistros.reduce((s, r) => s + (r.costo_total ?? 0), 0))}
                </p>
              </div>
            )}
          </div>
        )
      })()}

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
                  <label className="label">Valor día ($)</label>
                  <input
                    className="input num"
                    type="number"
                    placeholder="50000"
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
              {workers.map((w, i) => (
                <div
                  key={w.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    opacity: w.activo ? 1 : 0.5,
                  }}
                >
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    {/* N° */}
                    <span
                      className="w-5 flex-shrink-0 text-center num text-[12px] font-semibold"
                      style={{ color: 'var(--subtle)' }}
                    >
                      {i + 1}
                    </span>

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
                        {formatCLP(w.valor_hora)}/día
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

                    {/* Eliminar trabajador */}
                    {confirmDeleteWorkerId === w.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px]" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                        <button
                          onClick={() => handleDeleteWorker(w.id)}
                          className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                        >Sí</button>
                        <button
                          onClick={() => setConfirmDeleteWorkerId(null)}
                          className="p-1 rounded-lg"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteWorkerId(w.id)}
                        className="p-1.5 rounded-lg flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        title="Eliminar trabajador"
                      >
                        <Trash2 size={12} style={{ color: 'var(--red)' }} />
                      </button>
                    )}
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
                            const editandoClave = editingClave === o.id
                            return (
                              <div key={o.id} className="space-y-1">
                                <button
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

                                {/* Clave de la obra */}
                                {editandoClave ? (
                                  <div className="flex items-center gap-2 px-1">
                                    <input
                                      className="input num text-sm w-28 text-center"
                                      placeholder="ej: 1234"
                                      value={claveValue}
                                      maxLength={6}
                                      onChange={e => { setClaveValue(e.target.value.replace(/\D/g, '').slice(0, 6)); setClaveError('') }}
                                      onKeyDown={e => { if (e.key === 'Enter') handleGuardarClave(o.id); if (e.key === 'Escape') { setEditingClave(null); setClaveValue(''); setClaveError('') } }}
                                      autoFocus
                                      style={{ fontSize: 16, letterSpacing: '0.15em', padding: '6px 10px' }}
                                    />
                                    <button
                                      onClick={() => handleGuardarClave(o.id)}
                                      disabled={!claveValue.trim() || claveSaving}
                                      className="btn-primary gap-1 text-xs disabled:opacity-40"
                                      style={{ padding: '6px 10px' }}
                                    >
                                      {claveSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                    </button>
                                    <button
                                      onClick={() => { setEditingClave(null); setClaveValue(''); setClaveError('') }}
                                      className="btn-ghost text-xs"
                                      style={{ color: 'var(--muted)' }}
                                    >
                                      <X size={11} />
                                    </button>
                                    {claveError && (
                                      <p style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'DM Mono' }}>{claveError}</p>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingClave(o.id); setClaveValue(o.clave ?? ''); setClaveError('') }}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-opacity hover:opacity-70 text-left"
                                    style={{ marginLeft: 4 }}
                                  >
                                    <Hash size={11} style={{ color: o.clave ? 'var(--amber)' : 'var(--subtle)', flexShrink: 0 }} />
                                    {o.clave ? (
                                      <span className="num text-[12px] font-semibold" style={{ color: 'var(--amber)', letterSpacing: '0.1em' }}>
                                        {o.clave}
                                      </span>
                                    ) : (
                                      <span className="text-[11px]" style={{ color: 'var(--subtle)', fontFamily: 'DM Mono' }}>
                                        sin clave — asignar
                                      </span>
                                    )}
                                    <Pencil size={10} style={{ color: 'var(--subtle)', marginLeft: 2 }} />
                                  </button>
                                )}
                              </div>
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
                              <input
                                className="input num text-sm"
                                placeholder="Clave numérica (ej: 1234)"
                                value={newObraClave}
                                maxLength={6}
                                onChange={e => setNewObraClave(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                onKeyDown={e => e.key === 'Enter' && handleCrearObra(w)}
                                style={{ letterSpacing: '0.1em' }}
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
