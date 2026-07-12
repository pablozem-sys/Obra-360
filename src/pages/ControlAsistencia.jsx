import { useState, useEffect, useCallback, Fragment } from 'react'
import { Users, Clock, DollarSign, Plus, X, Check, ToggleLeft, ToggleRight, Loader2, AlertCircle, AlertTriangle, Pencil, Eye, EyeOff, Trash2, Search } from 'lucide-react'
import { formatCLP } from '../lib/helpers'
import { supabase } from '../lib/supabase'
import {
  getAllWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  getObrasActivas,
  getWorkerProjectIds,
  toggleWorkerProject,
  getAttendance,
  getAttendanceRange,
  registrarAsistenciaManual,
  actualizarTurno,
  deleteAttendance,
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

function formatFechaDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function initials(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

/* ── Fila de turno (reusada en Registros, Por Obra, Hora Entrada/Salida) ── */
function TurnoRow({
  r, isEditing, editEntrada, editSalida, editBono, editSaving, editError,
  onStartEdit, onCancelEdit, onChangeEntrada, onChangeSalida, onChangeBono, onGuardar,
  confirmDelete, deletingRecord, onRequestDelete, onConfirmDelete, onCancelDelete,
}) {
  const abierto = !r.salida
  const alerta = !abierto && r.horas_trabajadas != null && r.horas_trabajadas < 8

  return (
    <Fragment>
      <tr
        className="table-row"
        style={alerta ? { background: 'var(--red-dim)' } : {}}
      >
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              style={{ background: alerta ? 'rgba(255,69,96,0.2)' : 'var(--amber)', color: alerta ? 'var(--red)' : '#000' }}
            >
              {r.workers?.avatar}
            </div>
            <span className="text-sm font-medium" style={{ color: alerta ? 'var(--red)' : 'var(--text)' }}>{r.workers?.nombre}</span>
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
            <span className="num text-[13px] font-medium" style={{ color: alerta ? 'var(--red)' : 'var(--muted)' }}>{formatHora(r.salida)}</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : (alerta ? 'var(--red)' : 'var(--amber)') }}>
            {r.horas_trabajadas != null ? `${Number(r.horas_trabajadas).toFixed(1)}h` : '—'}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : (alerta ? 'var(--red)' : 'var(--green)') }}>
            {r.costo_total != null ? formatCLP(r.costo_total) : '—'}
          </span>
          {r.bono > 0 && (
            <p className="text-[10px] num" style={{ color: 'var(--amber)' }}>+{formatCLP(r.bono)} bono</p>
          )}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => isEditing ? onCancelEdit() : onStartEdit(r)}
              title="Editar turno"
              className="p-1.5 rounded-lg transition-all hover:opacity-80"
              style={{
                background: isEditing ? 'var(--amber-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${isEditing ? 'rgba(255,149,0,0.4)' : 'var(--border)'}`,
              }}
            >
              <Pencil size={12} style={{ color: isEditing ? 'var(--amber)' : 'var(--subtle)' }} />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                <button
                  onClick={() => onConfirmDelete(r.id)}
                  disabled={deletingRecord}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold disabled:opacity-50"
                  style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                >Sí</button>
                <button
                  onClick={onCancelDelete}
                  className="p-1 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
              </div>
            ) : (
              <button
                onClick={() => onRequestDelete(r.id)}
                title="Eliminar turno"
                className="p-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <Trash2 size={12} style={{ color: 'var(--red)' }} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isEditing && (
        <tr style={{ background: 'var(--bg-surface)' }}>
          <td colSpan={8} className="px-6 py-4">
            <div className="flex items-end gap-4 flex-wrap">
              <p style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: '0.2em', color: 'var(--amber)', textTransform: 'uppercase', flexShrink: 0, marginBottom: 8 }}>
                // editar turno — {r.workers?.nombre}
              </p>
              <div>
                <label className="label">Entrada</label>
                <TimePicker value={editEntrada} onChange={onChangeEntrada} />
              </div>
              <div>
                <label className="label">Salida <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
                <TimePicker value={editSalida} onChange={onChangeSalida} />
              </div>
              <div>
                <label className="label">Bono ($)</label>
                <input
                  type="number"
                  min="0"
                  className="input num w-28"
                  placeholder="0"
                  value={editBono}
                  onChange={e => onChangeBono(e.target.value)}
                />
              </div>
              <button
                onClick={() => onGuardar(r)}
                disabled={!editEntrada || editSaving}
                className="btn-primary gap-1 text-xs disabled:opacity-40"
                style={{ padding: '8px 14px', flexShrink: 0 }}
              >
                {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Guardar
              </button>
              <button
                onClick={onCancelEdit}
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
    </Fragment>
  )
}

const HOY = new Date().toISOString().split('T')[0]

export default function ControlAsistencia() {
  const [tab, setTab]               = useState('registros') // registros | por_fecha | trabajadores
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

  // Valor día inline edit por worker
  const [editingValor, setEditingValor] = useState(null)
  const [valorValue, setValorValue]     = useState('')
  const [valorSaving, setValorSaving]   = useState(false)
  const [valorError, setValorError]     = useState('')
  const [showPins, setShowPins]       = useState({})

  // Nombre inline edit por worker
  const [editingNombre, setEditingNombre] = useState(null)
  const [nombreValue, setNombreValue]     = useState('')
  const [nombreSaving, setNombreSaving]   = useState(false)
  const [nombreError, setNombreError]     = useState('')

  // Buscador de trabajadores
  const [buscarWorker, setBuscarWorker] = useState('')

  // Obras asignadas por worker
  const [obrasActivas, setObrasActivas]       = useState([])
  const [expandedObras, setExpandedObras]     = useState(null)
  const [workerObras, setWorkerObras]         = useState({})
  const [obrasLoading, setObrasLoading]       = useState(false)
  const [obrasToggling, setObrasToggling]     = useState({})
  const [addObraId, setAddObraId]             = useState('')
  const [obrasPanel, setObrasPanel]           = useState([]) // obras frescas cargadas al abrir panel

  // Registro manual de asistencia
  const [showManual, setShowManual]           = useState(false)
  const [manualWorker, setManualWorker]       = useState('')
  const [manualObra, setManualObra]           = useState('')
  const [manualFecha, setManualFecha]         = useState(HOY)
  const [manualEntrada, setManualEntrada]     = useState('08:30')
  const [manualSalida, setManualSalida]       = useState('17:30')
  const [manualBono, setManualBono]           = useState('')
  const [manualSaving, setManualSaving]       = useState(false)
  const [manualError, setManualError]         = useState('')

  // Editar turno (entrada, salida y bono) de un registro
  const [editingRecord, setEditingRecord]   = useState(null)
  const [editEntrada, setEditEntrada]       = useState('')
  const [editSalida, setEditSalida]         = useState('')
  const [editBono, setEditBono]             = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(false)

  // Vista compartida: Por Obra / Hora Entrada / Hora Salida (un solo día)
  const [vistaFecha, setVistaFecha]         = useState(HOY)
  const [registrosVista, setRegistrosVista] = useState([])
  const [loadingVista, setLoadingVista]     = useState(true)

  // Por Fecha
  const now = new Date()
  const pad2 = n => String(n).padStart(2, '0')
  const [rangoMode, setRangoMode]       = useState('mes')
  const [rangoMes, setRangoMes]         = useState(now.getMonth())
  const [rangoAnio, setRangoAnio]       = useState(now.getFullYear())
  const [rangoDesde, setRangoDesde]     = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`)
  const [rangoHasta, setRangoHasta]     = useState(HOY)
  const [rangoObra, setRangoObra]       = useState('all')
  const [registrosFecha, setRegistrosFecha] = useState([])
  const [loadingFecha, setLoadingFecha]     = useState(false)


  // Eliminar trabajador
  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState(null)

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
      getObrasActivas().then(data => { setProjects(data); setObrasActivas(data) }).catch(() => { setProjects([]); setObrasActivas([]) }),
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
    setLoadingVista(true)
    getAttendance({ fecha: vistaFecha })
      .then(setRegistrosVista)
      .catch(() => setRegistrosVista([]))
      .finally(() => setLoadingVista(false))
  }, [vistaFecha])

  useEffect(() => {
    if (tab !== 'por_fecha') return
    const pad = n => String(n).padStart(2, '0')
    let desde, hasta
    if (rangoMode === 'mes') {
      desde = `${rangoAnio}-${pad(rangoMes + 1)}-01`
      const lastDay = new Date(rangoAnio, rangoMes + 1, 0).getDate()
      hasta = `${rangoAnio}-${pad(rangoMes + 1)}-${pad(lastDay)}`
    } else {
      desde = rangoDesde
      hasta = rangoHasta
      if (!desde || !hasta) return
    }
    setLoadingFecha(true)
    getAttendanceRange({
      desde,
      hasta,
      projectId: rangoObra !== 'all' ? rangoObra : undefined,
    })
      .then(setRegistrosFecha)
      .catch(() => setRegistrosFecha([]))
      .finally(() => setLoadingFecha(false))
  }, [tab, rangoMode, rangoMes, rangoAnio, rangoDesde, rangoHasta, rangoObra])

  // Summary stats
  const enObra     = registros.filter(r => !r.salida).length
  const totalHoras = registros.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0)
  const totalCosto = registros.reduce((s, r) => s + (r.costo_total ?? 0), 0)
  const registrosVisibles = soloAbiertos ? registros.filter(r => !r.salida) : registros
  const workersFiltrados = buscarWorker.trim()
    ? workers.filter(w => w.nombre?.toLowerCase().includes(buscarWorker.trim().toLowerCase()))
    : workers

  // PINs duplicados entre trabajadores activos (colisión en login de kiosco)
  const pinCounts = workers.reduce((acc, w) => {
    if (w.pin && w.activo) acc[w.pin] = (acc[w.pin] ?? 0) + 1
    return acc
  }, {})
  const workersPinDuplicado = new Set(
    workers.filter(w => w.pin && w.activo && pinCounts[w.pin] > 1).map(w => w.id)
  )

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
        bono:       manualBono ? parseInt(manualBono) : 0,
      })
      await loadRegistros()
      setShowManual(false)
      setManualWorker('')
      setManualObra('')
      setManualFecha(HOY)
      setManualEntrada('08:30')
      setManualSalida('17:30')
      setManualBono('')
    } catch (err) {
      setManualError(err.message || 'Error al guardar')
    } finally {
      setManualSaving(false)
    }
  }

  const handleStartEdit = (r) => {
    setEditingRecord(r.id)
    setEditEntrada(formatHora(r.entrada))
    setEditSalida(r.salida ? formatHora(r.salida) : '')
    setEditBono(r.bono > 0 ? String(r.bono) : '')
    setEditError('')
  }

  const handleCancelEdit = () => {
    setEditingRecord(null)
    setEditEntrada('')
    setEditSalida('')
    setEditBono('')
    setEditError('')
  }

  const handleGuardarTurno = async (record, setList) => {
    if (!editEntrada) { setEditError('Ingresa la hora de entrada'); return }
    if (editSalida && editSalida <= editEntrada) {
      setEditError('La salida debe ser después de la entrada')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await actualizarTurno(record.id, {
        horaEntrada: editEntrada,
        fecha:       record.fecha,
        horaSalida:  editSalida || null,
        valorHora:   record.valor_hora ?? 5000,
        bono:        editBono ? parseInt(editBono) : 0,
      })
      setList(prev => prev.map(r => r.id === record.id ? { ...r, ...updated } : r))
      setEditingRecord(null)
      setEditEntrada('')
      setEditSalida('')
      setEditBono('')
    } catch (err) {
      setEditError(err.message || 'Error al guardar')
    } finally {
      setEditSaving(false)
    }
  }

  const handleEliminarTurno = async (recordId, setList) => {
    setDeletingRecord(true)
    try {
      await deleteAttendance(recordId)
      setList(prev => prev.filter(r => r.id !== recordId))
      setConfirmDeleteRecordId(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingRecord(false)
    }
  }

  const renderTurnoRow = (r, setList) => (
    <TurnoRow
      key={r.id}
      r={r}
      isEditing={editingRecord === r.id}
      editEntrada={editEntrada}
      editSalida={editSalida}
      editBono={editBono}
      editSaving={editSaving}
      editError={editError}
      onStartEdit={handleStartEdit}
      onCancelEdit={handleCancelEdit}
      onChangeEntrada={v => { setEditEntrada(v); setEditError('') }}
      onChangeSalida={v => { setEditSalida(v); setEditError('') }}
      onChangeBono={setEditBono}
      onGuardar={rec => handleGuardarTurno(rec, setList)}
      confirmDelete={confirmDeleteRecordId === r.id}
      deletingRecord={deletingRecord}
      onRequestDelete={id => setConfirmDeleteRecordId(id)}
      onConfirmDelete={id => handleEliminarTurno(id, setList)}
      onCancelDelete={() => setConfirmDeleteRecordId(null)}
    />
  )

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
    setObrasLoading(true)
    try {
      const [ids, todas] = await Promise.all([
        getWorkerProjectIds(worker.id),
        getObrasActivas(),
      ])
      setWorkerObras(prev => ({ ...prev, [worker.id]: new Set(ids) }))
      setObrasPanel(todas)
    } catch { /* silent */ }
    finally { setObrasLoading(false) }
  }

  const handleToggleObra = async (worker, projectId) => {
    const key = `${worker.id}-${projectId}`
    const current = workerObras[worker.id] ?? new Set()
    const assign = !current.has(projectId)
    setWorkerObras(prev => {
      const next = new Set(prev[worker.id] ?? [])
      assign ? next.add(projectId) : next.delete(projectId)
      return { ...prev, [worker.id]: next }
    })
    setObrasToggling(prev => ({ ...prev, [key]: true }))
    try {
      await toggleWorkerProject(worker.id, projectId, assign)
    } catch {
      setWorkerObras(prev => {
        const next = new Set(prev[worker.id] ?? [])
        assign ? next.delete(projectId) : next.add(projectId)
        return { ...prev, [worker.id]: next }
      })
    }
    setObrasToggling(prev => ({ ...prev, [key]: false }))
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

  const handleGuardarValor = async (worker) => {
    const val = parseInt(valorValue)
    if (!val || val < 1000) { setValorError('Mínimo $1.000'); return }
    setValorError('')
    setValorSaving(true)
    try {
      const updated = await updateWorker(worker.id, { valor_hora: val })
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...updated } : w))
      setEditingValor(null)
      setValorValue('')
    } catch { setValorError('Error al guardar') }
    finally { setValorSaving(false) }
  }

  const handleGuardarNombre = async (worker) => {
    const nombre = nombreValue.trim()
    if (!nombre) { setNombreError('Ingresa un nombre'); return }
    setNombreError('')
    setNombreSaving(true)
    try {
      const updated = await updateWorker(worker.id, { nombre, avatar: initials(nombre) })
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, ...updated } : w))
      setEditingNombre(null)
      setNombreValue('')
    } catch { setNombreError('Error al guardar') }
    finally { setNombreSaving(false) }
  }

  const handleToggleActivo = async (worker) => {
    const optimistic = workers.map(w => w.id === worker.id ? { ...w, activo: !w.activo } : w)
    setWorkers(optimistic)
    try {
      await updateWorker(worker.id, { activo: !worker.activo })
    } catch {
      setWorkers(workers)
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
          { key: 'registros',     label: 'Registros' },
          { key: 'por_fecha',     label: 'Por Fecha' },
          { key: 'por_obra',      label: 'Por Obra' },
          { key: 'hora_entrada',  label: 'Hora Entrada' },
          { key: 'hora_salida',   label: 'Hora Salida' },
          { key: 'trabajadores',  label: 'Trabajadores' },
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

      {/* Selector de fecha compartido — Por Obra / Hora Entrada / Hora Salida */}
      {['por_obra', 'hora_entrada', 'hora_salida'].includes(tab) && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.05em' }}>DÍA</span>
          <input type="date" className="input" value={vistaFecha} onChange={e => setVistaFecha(e.target.value)} />
        </div>
      )}

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
                <div>
                  <label className="label">Bono ($) <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
                  <input
                    type="number"
                    min="0"
                    className="input num"
                    placeholder="0"
                    value={manualBono}
                    onChange={e => setManualBono(e.target.value)}
                  />
                </div>
                {manualWorker && manualEntrada && manualSalida && manualSalida > manualEntrada && (
                  <div className="flex flex-col justify-end pb-0.5">
                    <label className="label">Costo estimado</label>
                    {(() => {
                      const horas = (new Date(`${manualFecha}T${manualSalida}`) - new Date(`${manualFecha}T${manualEntrada}`)) / 3600000
                      const valorDia = workers.find(w => w.id === manualWorker)?.valor_hora ?? 50000
                      const bonoNum = manualBono ? parseInt(manualBono) : 0
                      const costo = (horas >= 8 ? valorDia : Math.round((horas / 8) * valorDia)) + bonoNum
                      const alerta = horas < 8
                      return (
                        <>
                          <p className="num font-bold text-base" style={{ color: alerta ? 'var(--red)' : 'var(--green)' }}>
                            {formatCLP(costo)}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: alerta ? 'var(--red)' : 'var(--subtle)', fontFamily: 'DM Mono' }}>
                            {horas.toFixed(1)}h{alerta ? ' ⚠ menos de 8h' : ''}{bonoNum > 0 ? ` · +${formatCLP(bonoNum)} bono` : ''}
                          </p>
                        </>
                      )
                    })()}
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
                    {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosVisibles.map(r => renderTurnoRow(r, setRegistros))}
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

      {/* ── TAB: POR FECHA ─────────────────────────────────────── */}
      {tab === 'por_fecha' && (() => {
        const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const aniosDisp = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

        // Agrupar por fecha → obra
        const porFechaGrupos = {}
        registrosFecha.forEach(r => {
          const f   = r.fecha
          const pid = r.project_id
          if (!porFechaGrupos[f]) porFechaGrupos[f] = { obras: {} }
          if (!porFechaGrupos[f].obras[pid]) {
            porFechaGrupos[f].obras[pid] = { nombre: r.projects?.nombre ?? '—', registros: [] }
          }
          porFechaGrupos[f].obras[pid].registros.push(r)
        })
        const fechasOrdenadas = Object.keys(porFechaGrupos).sort((a, b) => b.localeCompare(a))

        // Resumen por trabajador
        const resumenMap = {}
        registrosFecha.forEach(r => {
          const wid = r.worker_id
          if (!resumenMap[wid]) resumenMap[wid] = {
            nombre: r.workers?.nombre ?? '—',
            avatar: r.workers?.avatar ?? '?',
            dias: 0, horas: 0, costo: 0,
          }
          resumenMap[wid].dias  += 1
          resumenMap[wid].horas += r.horas_trabajadas ?? 0
          resumenMap[wid].costo += r.costo_total ?? 0
        })
        const resumenList = Object.values(resumenMap).sort((a, b) => b.costo - a.costo)
        const totalCostoGeneral = resumenList.reduce((s, w) => s + w.costo, 0)

        return (
          <div className="space-y-4">
            {/* Selectores */}
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {[{ key: 'mes', label: 'Por mes' }, { key: 'rango', label: 'Rango' }].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setRangoMode(m.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: rangoMode === m.key ? 'var(--amber)' : 'transparent',
                      color:      rangoMode === m.key ? '#000' : 'var(--muted)',
                      fontFamily: 'Instrument Sans',
                    }}
                  >{m.label}</button>
                ))}
              </div>

              {rangoMode === 'mes' ? (
                <>
                  <select className="select" value={rangoMes} onChange={e => setRangoMes(parseInt(e.target.value))}>
                    {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="select" value={rangoAnio} onChange={e => setRangoAnio(parseInt(e.target.value))}>
                    {aniosDisp.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.05em' }}>DESDE</span>
                    <input type="date" className="input" value={rangoDesde} onChange={e => setRangoDesde(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.05em' }}>HASTA</span>
                    <input type="date" className="input" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} />
                  </div>
                </>
              )}

              <select className="select" value={rangoObra} onChange={e => setRangoObra(e.target.value)}>
                <option value="all">Todas las obras</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            {loadingFecha ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
              </div>
            ) : fechasOrdenadas.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin registros para este período</p>
              </div>
            ) : (
              <>
                {/* Agrupado por fecha */}
                {fechasOrdenadas.map(fecha => {
                  const grupo = porFechaGrupos[fecha]
                  const obras = Object.entries(grupo.obras)
                  const totalRegistros = obras.reduce((s, [, o]) => s + o.registros.length, 0)
                  const totalHorasFecha = obras.reduce((s, [, o]) => s + o.registros.reduce((ss, r) => ss + (r.horas_trabajadas ?? 0), 0), 0)
                  const totalCostoFecha = obras.reduce((s, [, o]) => s + o.registros.reduce((ss, r) => ss + (r.costo_total ?? 0), 0), 0)

                  return (
                    <div key={fecha} className="space-y-2">
                      {/* Fecha header */}
                      <div
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'var(--amber-dim)', border: '1px solid rgba(255,149,0,0.25)' }}
                      >
                        <div>
                          <p style={{ fontFamily: 'Unbounded', fontSize: 11, fontWeight: 700, color: 'var(--amber)', textTransform: 'capitalize', letterSpacing: '0.04em' }}>
                            {formatFechaDate(fecha)}
                          </p>
                          <p className="num text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                            {totalRegistros} trabajadores · {totalHorasFecha.toFixed(1)} hrs
                          </p>
                        </div>
                        <p className="num font-bold text-sm" style={{ color: 'var(--amber)' }}>{formatCLP(totalCostoFecha)}</p>
                      </div>

                      {/* Obras */}
                      {obras.map(([obraId, obra]) => (
                        <div key={obraId} className="card overflow-hidden" style={{ marginLeft: 12 }}>
                          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                            <p style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {obra.nombre}
                            </p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px]">
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                                  {['Trabajador', 'Entrada', 'Salida', 'Horas', 'Valor Día', 'Costo'].map(h => (
                                    <th key={h} className="px-4 py-2 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {obra.registros.map(r => {
                                  const alerta = r.horas_trabajadas != null && r.salida && r.horas_trabajadas < 8
                                  return (
                                    <tr
                                      key={r.id}
                                      className="table-row"
                                      style={alerta ? { background: 'var(--red-dim)' } : {}}
                                    >
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                            style={{ background: alerta ? 'rgba(255,69,96,0.2)' : 'var(--amber)', color: alerta ? 'var(--red)' : '#000' }}
                                          >
                                            {r.workers?.avatar}
                                          </div>
                                          <span className="text-sm font-medium" style={{ color: alerta ? 'var(--red)' : 'var(--text)' }}>
                                            {r.workers?.nombre}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="num text-[12px]" style={{ color: 'var(--green)' }}>{formatHora(r.entrada)}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {r.salida
                                          ? <span className="num text-[12px]" style={{ color: alerta ? 'var(--red)' : 'var(--text)' }}>{formatHora(r.salida)}</span>
                                          : <span style={{ fontSize: 11, fontFamily: 'Unbounded', fontWeight: 700, color: 'var(--amber)' }}>EN OBRA</span>
                                        }
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="num text-[13px] font-semibold" style={{ color: alerta ? 'var(--red)' : 'var(--amber)' }}>
                                          {r.horas_trabajadas != null ? `${Number(r.horas_trabajadas).toFixed(1)}h` : '—'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                                          {r.valor_hora != null ? formatCLP(r.valor_hora) : '—'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="num text-[13px] font-semibold" style={{ color: alerta ? 'var(--red)' : 'var(--green)' }}>
                                          {r.costo_total != null ? formatCLP(r.costo_total) : '—'}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Resumen general del período */}
                {resumenList.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                      <h2 className="section-title">Resumen del período</h2>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {resumenList.length} trabajadores
                      </p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Trabajador', 'Días', 'Horas', 'Total a Pagar'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumenList.map(w => (
                          <tr key={w.nombre} className="table-row">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: 'var(--amber)', color: '#000' }}>
                                  {w.avatar}
                                </div>
                                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{w.nombre}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="num text-[13px] font-semibold" style={{ color: 'var(--amber)' }}>{w.dias}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="num text-[13px]" style={{ color: 'var(--muted)' }}>{w.horas.toFixed(1)}</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="num text-[13px] font-bold" style={{ color: 'var(--green)' }}>{formatCLP(w.costo)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      className="flex items-center justify-between px-5 py-4"
                      style={{ borderTop: '1px solid var(--border)', background: 'var(--amber-dim)' }}
                    >
                      <p style={{ fontFamily: 'Unbounded', fontSize: 9, letterSpacing: '0.15em', color: 'var(--amber)', textTransform: 'uppercase' }}>
                        Total período
                      </p>
                      <p className="num font-bold text-xl" style={{ color: 'var(--amber)' }}>{formatCLP(totalCostoGeneral)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* ── TAB: POR OBRA ───────────────────────────────────────── */}
      {tab === 'por_obra' && (() => {
        const resumenPorObra = [...obrasActivas]
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map(p => {
            const regs = registrosVista.filter(r => r.project_id === p.id)
            const cerrados = regs.filter(r => r.costo_total != null)
            return {
              ...p,
              nTrabajadores: new Set(regs.map(r => r.worker_id)).size,
              horasTotales: cerrados.reduce((s, r) => s + (r.horas_trabajadas ?? 0), 0),
              costoManoObra: cerrados.reduce((s, r) => s + (r.costo_total ?? 0), 0),
              registros: regs,
            }
          })

        if (loadingVista) {
          return (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
            </div>
          )
        }

        return (
          <div className="space-y-4">
            {resumenPorObra.map(obra => (
              <div key={obra.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                >
                  <div>
                    <h2 className="section-title">{obra.nombre}</h2>
                    <p className="num text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {obra.nTrabajadores} trabajadores · {obra.horasTotales.toFixed(1)} hrs
                    </p>
                  </div>
                  <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>{formatCLP(obra.costoManoObra)}</p>
                </div>
                {obra.registros.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>Sin trabajadores este día</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[580px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                          {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo', ''].map(h => (
                            <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {obra.registros.map(r => renderTurnoRow(r, setRegistrosVista))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            {resumenPorObra.length === 0 && (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay obras activas</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TAB: HORA ENTRADA ───────────────────────────────────── */}
      {tab === 'hora_entrada' && (() => {
        const porEntrada = [...registrosVista].sort((a, b) => new Date(a.entrada) - new Date(b.entrada))
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="section-title">Ordenado por hora de entrada ({porEntrada.length})</h2>
            </div>
            {loadingVista ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                      {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porEntrada.map(r => renderTurnoRow(r, setRegistrosVista))}
                    {porEntrada.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
                          Sin registros este día
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TAB: HORA SALIDA ────────────────────────────────────── */}
      {tab === 'hora_salida' && (() => {
        const conSalida = registrosVista.filter(r => r.salida).sort((a, b) => new Date(a.salida) - new Date(b.salida))
        const sinSalida = registrosVista.filter(r => !r.salida)
        const porSalida = [...conSalida, ...sinSalida]
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="section-title">Ordenado por hora de salida ({porSalida.length})</h2>
            </div>
            {loadingVista ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                      {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porSalida.map(r => renderTurnoRow(r, setRegistrosVista))}
                    {porSalida.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
                          Sin registros este día
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              <h2 className="section-title">Trabajadores ({workersFiltrados.length})</h2>
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

          {/* Aviso: trabajadores con el mismo PIN */}
          {workersPinDuplicado.size > 0 && (
            <div
              className="flex items-center gap-3 px-5 py-3"
              style={{ background: 'rgba(255,69,96,0.08)', borderBottom: '1px solid rgba(255,69,96,0.3)' }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--red)' }} className="flex-shrink-0" />
              <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
                <span className="font-semibold" style={{ color: 'var(--red)' }}>
                  {workersPinDuplicado.size} trabajador{workersPinDuplicado.size !== 1 ? 'es' : ''}
                </span>{' '}
                {workersPinDuplicado.size === 1 ? 'tiene' : 'tienen'} el mismo PIN que otro trabajador
                ({workers.filter(w => workersPinDuplicado.has(w.id)).map(w => w.nombre).join(', ')}).
                Cámbialo para evitar que uno marque asistencia a nombre del otro.
              </p>
            </div>
          )}

          {/* Buscador */}
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={buscarWorker}
                onChange={e => setBuscarWorker(e.target.value)}
                className="input pl-10 text-sm"
              />
            </div>
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
                  <label className="label">Valor Día ($)</label>
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
          {workersFiltrados.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {buscarWorker.trim() ? 'Sin resultados para tu búsqueda' : 'No hay trabajadores registrados'}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--subtle)' }}>
                {buscarWorker.trim() ? 'Prueba con otro nombre' : 'Agrega el primero con el botón "Nuevo"'}
              </p>
            </div>
          ) : (
            <div>
              {workersFiltrados.map((w, i) => (
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
                      {editingNombre === w.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input"
                            value={nombreValue}
                            onChange={e => { setNombreValue(e.target.value); setNombreError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') handleGuardarNombre(w); if (e.key === 'Escape') { setEditingNombre(null); setNombreValue(''); setNombreError('') } }}
                            autoFocus
                            style={{ width: 180, fontSize: 13, padding: '3px 8px' }}
                          />
                          <button
                            onClick={() => handleGuardarNombre(w)}
                            disabled={nombreSaving}
                            className="p-1 rounded-md disabled:opacity-40"
                            style={{ background: 'var(--amber)', color: '#000' }}
                          >
                            {nombreSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button
                            onClick={() => { setEditingNombre(null); setNombreValue(''); setNombreError('') }}
                            className="p-1 rounded-md"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                          >
                            <X size={11} style={{ color: 'var(--subtle)' }} />
                          </button>
                          {nombreError && <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'DM Mono' }}>{nombreError}</span>}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNombre(w.id); setNombreValue(w.nombre); setNombreError('') }}
                          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
                        >
                          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{w.nombre}</span>
                          <Pencil size={10} style={{ color: 'var(--subtle)' }} />
                        </button>
                      )}
                      {editingValor === w.id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            className="input num"
                            type="number"
                            value={valorValue}
                            onChange={e => { setValorValue(e.target.value); setValorError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') handleGuardarValor(w); if (e.key === 'Escape') { setEditingValor(null); setValorValue(''); setValorError('') } }}
                            autoFocus
                            style={{ width: 110, fontSize: 12, padding: '3px 8px' }}
                          />
                          <button
                            onClick={() => handleGuardarValor(w)}
                            disabled={valorSaving}
                            className="p-1 rounded-md disabled:opacity-40"
                            style={{ background: 'var(--amber)', color: '#000' }}
                          >
                            {valorSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button
                            onClick={() => { setEditingValor(null); setValorValue(''); setValorError('') }}
                            className="p-1 rounded-md"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                          >
                            <X size={11} style={{ color: 'var(--subtle)' }} />
                          </button>
                          {valorError && <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'DM Mono' }}>{valorError}</span>}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingValor(w.id); setValorValue(String(w.valor_hora)); setValorError('') }}
                          className="flex items-center gap-1 mt-0.5 transition-opacity hover:opacity-70"
                        >
                          <span className="text-[12px] num" style={{ color: 'var(--muted)' }}>{formatCLP(w.valor_hora)}/día</span>
                          <Pencil size={10} style={{ color: 'var(--subtle)' }} />
                        </button>
                      )}
                    </div>

                    {/* PIN badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {w.pin ? (
                        <>
                          <span
                            className="num text-[13px] tracking-widest"
                            style={{ color: workersPinDuplicado.has(w.id) ? 'var(--red)' : (showPins[w.id] ? 'var(--text)' : 'var(--subtle)') }}
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
                          {workersPinDuplicado.has(w.id) && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                              style={{
                                fontFamily: 'Unbounded',
                                background: 'rgba(255,69,96,0.1)',
                                color: 'var(--red)',
                                border: '1px solid rgba(255,69,96,0.2)',
                              }}
                              title="Otro trabajador usa el mismo PIN"
                            >
                              DUPLICADO
                            </span>
                          )}
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

                  {/* Obras asignadas — fila secundaria con botón siempre visible */}
                  <div
                    className="px-5 pb-3 flex items-center gap-2"
                    style={{ marginTop: -4 }}
                  >
                    <button
                      onClick={() => handleExpandObras(w)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-lg transition-all"
                      style={{
                        fontFamily: 'Unbounded',
                        letterSpacing: '0.05em',
                        background: expandedObras === w.id ? 'var(--amber-dim)' : 'var(--bg-elevated)',
                        color:      expandedObras === w.id ? 'var(--amber)' : 'var(--subtle)',
                        border:     `1px solid ${expandedObras === w.id ? 'rgba(255,149,0,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      <Plus size={10} />
                      Obras asignadas
                    </button>
                    {workerObras[w.id] && workerObras[w.id].size > 0 && (
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {workerObras[w.id].size} asignada{workerObras[w.id].size !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {expandedObras === w.id && (
                    <div
                      className="px-5 pb-4"
                      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', paddingTop: 14 }}
                    >
                      {obrasLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--amber)' }} />
                        </div>
                      ) : (() => {
                        const asignadas   = obrasPanel.filter(o =>  workerObras[w.id]?.has(o.id))
                        const disponibles = obrasPanel.filter(o => !workerObras[w.id]?.has(o.id))
                        return (
                          <div className="space-y-3">
                            {/* Chips de obras asignadas */}
                            {asignadas.length === 0 ? (
                              <p className="text-[12px]" style={{ color: 'var(--subtle)' }}>Sin obras asignadas</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {asignadas.map(o => {
                                  const toggling = obrasToggling[`${w.id}-${o.id}`]
                                  return (
                                    <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                      style={{ background: 'var(--amber-dim)', border: '1px solid rgba(255,149,0,0.35)' }}>
                                      <span className="text-sm font-medium" style={{ color: 'var(--amber)' }}>{o.nombre}</span>
                                      <button onClick={() => handleToggleObra(w, o.id)} disabled={toggling}
                                        className="disabled:opacity-40 hover:opacity-70 transition-opacity">
                                        {toggling
                                          ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--amber)' }} />
                                          : <X size={12} style={{ color: 'var(--amber)' }} />}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {/* Dropdown para agregar obra */}
                            {disponibles.length > 0 && (
                              <div className="flex gap-2">
                                <select className="select flex-1 text-sm" value={addObraId}
                                  onChange={e => setAddObraId(e.target.value)}>
                                  <option value="">Agregar obra...</option>
                                  {disponibles.map(o => (
                                    <option key={o.id} value={o.id}>{o.nombre}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={async () => { if (!addObraId) return; await handleToggleObra(w, addObraId); setAddObraId('') }}
                                  disabled={!addObraId}
                                  className="btn-primary gap-1 text-xs disabled:opacity-40 flex-shrink-0"
                                  style={{ padding: '8px 14px' }}
                                >
                                  <Plus size={13} /> Agregar
                                </button>
                              </div>
                            )}
                            {obrasPanel.length === 0 && (
                              <p className="text-[12px]" style={{ color: 'var(--subtle)' }}>No hay obras en ejecución</p>
                            )}
                          </div>
                        )
                      })()}
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
