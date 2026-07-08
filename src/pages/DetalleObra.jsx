import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Loader2, Eye, Download, Pencil, AlertCircle,
  TrendingDown, TrendingUp, Clock, CheckCircle2, X, Info, Trash2,
  Upload, Camera
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import {
  getObras, getGastos, getIngresos, getDocumentos,
  updateObra, createIngreso, updateIngreso, deleteIngreso, getAttendanceByProject,
  getAdditionalSales, createAdditionalSale, deleteAdditionalSale,
  updateGasto, deleteGasto, uploadDocumento, createDocumento,
} from '../lib/supabase'
import {
  formatCLP, formatDate,
  TIPOS_OBRA, ESTADOS_OBRA, CATEGORIAS_GASTO, TIPOS_DOC,
} from '../lib/helpers'

const TIPOS   = ['piscina', 'quincho', 'ampliacion', 'remodelacion', '360', 'otro']
const ESTADOS = ['cotizada', 'en_ejecucion', 'pausada', 'finalizada']
const HOY     = new Date().toISOString().split('T')[0]

export default function DetalleObra() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [obra,            setObra]            = useState(null)
  const [gastos,          setGastos]          = useState([])
  const [ingresos,        setIngresos]        = useState([])
  const [asistencia,      setAsistencia]      = useState([])
  const [docs,            setDocs]            = useState([])
  const [additionalSales, setAdditionalSales] = useState([])
  const [loading,         setLoading]         = useState(true)

  // Ventas adicionales
  const ventaFileRef = useRef()
  const [showAddVenta,  setShowAddVenta]  = useState(false)
  const [ventaDesc,     setVentaDesc]     = useState('')
  const [ventaMonto,    setVentaMonto]    = useState('')
  const [ventaFile,     setVentaFile]     = useState(null)
  const [ventaFileName, setVentaFileName] = useState(null)
  const [ventaSaving,   setVentaSaving]   = useState(false)
  const [ventaError,    setVentaError]    = useState('')
  const [ventaDocFailed, setVentaDocFailed] = useState(false)
  const [confirmDeleteVentaId, setConfirmDeleteVentaId] = useState(null)

  // Editar / eliminar gasto
  const [editGasto,       setEditGasto]       = useState(null)
  const [editGastoForm,   setEditGastoForm]   = useState({})
  const [editGastoSaving, setEditGastoSaving] = useState(false)
  const [editGastoError,  setEditGastoError]  = useState('')
  const [confirmDelGasto, setConfirmDelGasto] = useState(null)
  const [deletingGasto,   setDeletingGasto]   = useState(false)

  // Modal editar obra
  const [showEdit,  setShowEdit]  = useState(false)
  const [editForm,  setEditForm]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [editError, setEditError] = useState('')

  // Modal agregar abono
  const [showAbono,    setShowAbono]    = useState(false)
  const [abonoMonto,   setAbonoMonto]   = useState('')
  const [abonoFecha,   setAbonoFecha]   = useState(HOY)
  const [abonoDesc,    setAbonoDesc]    = useState('')
  const [abonoSaving,  setAbonoSaving]  = useState(false)
  const [abonoError,   setAbonoError]   = useState('')

  // Eliminar abono
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Modal editar abono
  const [editAbono,       setEditAbono]       = useState(null)
  const [editAbonoMonto,  setEditAbonoMonto]  = useState('')
  const [editAbonoFecha,  setEditAbonoFecha]  = useState('')
  const [editAbonoDesc,   setEditAbonoDesc]   = useState('')
  const [editAbonoSaving, setEditAbonoSaving] = useState(false)
  const [editAbonoError,  setEditAbonoError]  = useState('')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getObras().catch(() => []),
      getGastos(id).catch(() => []),
      getIngresos().catch(() => []),
      getDocumentos(id).catch(() => []),
      getAttendanceByProject(id).catch(() => []),
      getAdditionalSales(id).catch(() => []),
    ]).then(([obras, g, ing, d, asis, addSales]) => {
      setObra(obras.find(o => o.id === id) ?? null)
      setGastos(g)
      setIngresos(ing.filter(i => i.project_id === id))
      setDocs(d)
      setAsistencia(asis)
      setAdditionalSales(addSales)
    }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [id])

  const openEdit = () => {
    setEditForm({
      nombre:        obra.nombre ?? '',
      direccion:     obra.direccion ?? '',
      tipo:          obra.tipo ?? 'otro',
      estado:        obra.estado ?? 'cotizada',
      fecha_inicio:  obra.fecha_inicio ?? '',
      fecha_termino: obra.fecha_termino ?? '',
      presupuesto:   obra.presupuesto ?? '',
      descripcion:   obra.descripcion ?? '',
    })
    setEditError('')
    setShowEdit(true)
  }

  const handleSave = async () => {
    if (!editForm.nombre.trim()) { setEditError('Ingresa el nombre de la obra'); return }
    setSaving(true)
    setEditError('')
    try {
      const updated = await updateObra(id, {
        nombre:        editForm.nombre.trim(),
        direccion:     editForm.direccion.trim() || null,
        tipo:          editForm.tipo,
        estado:        editForm.estado,
        fecha_inicio:  editForm.fecha_inicio || null,
        fecha_termino: editForm.fecha_termino || null,
        presupuesto:   parseInt(editForm.presupuesto) || null,
        descripcion:   editForm.descripcion.trim() || null,
      })
      setObra(updated)
      setShowEdit(false)
    } catch (err) {
      setEditError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleAgregarAbono = async () => {
    if (!abonoMonto || parseInt(abonoMonto) <= 0) { setAbonoError('Ingresa un monto válido'); return }
    setAbonoSaving(true)
    setAbonoError('')
    try {
      const nuevo = await createIngreso({
        project_id:  id,
        monto:       parseInt(abonoMonto),
        fecha:       abonoFecha,
        descripcion: abonoDesc.trim() || null,
        estado:      'cobrado',
      })
      setIngresos(prev => [nuevo, ...prev])
      setShowAbono(false)
      setAbonoMonto('')
      setAbonoFecha(HOY)
      setAbonoDesc('')
    } catch (err) {
      setAbonoError(err.message || 'Error al guardar')
    } finally {
      setAbonoSaving(false)
    }
  }

  const handleDeleteAbono = async (id) => {
    try {
      await deleteIngreso(id)
      setIngresos(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const openEditAbono = (ingreso) => {
    setEditAbono(ingreso)
    setEditAbonoMonto(String(ingreso.monto ?? ''))
    setEditAbonoFecha(ingreso.fecha ?? HOY)
    setEditAbonoDesc(ingreso.descripcion ?? '')
    setEditAbonoError('')
  }

  const handleGuardarAbono = async () => {
    if (!editAbonoMonto || parseInt(editAbonoMonto) <= 0) { setEditAbonoError('Ingresa un monto válido'); return }
    setEditAbonoSaving(true)
    setEditAbonoError('')
    try {
      const updated = await updateIngreso(editAbono.id, {
        monto:       parseInt(editAbonoMonto),
        fecha:       editAbonoFecha,
        descripcion: editAbonoDesc.trim() || null,
      })
      setIngresos(prev => prev.map(i => i.id === editAbono.id ? { ...i, ...updated } : i))
      setEditAbono(null)
    } catch (err) {
      setEditAbonoError(err.message || 'Error al guardar')
    } finally {
      setEditAbonoSaving(false)
    }
  }

  const handleAgregarVenta = async () => {
    if (!ventaDesc.trim()) { setVentaError('Ingresa una descripción'); return }
    if (!ventaMonto || parseInt(ventaMonto) <= 0) { setVentaError('Ingresa un monto válido'); return }
    setVentaSaving(true)
    setVentaError('')
    try {
      let docUrl = null
      if (ventaFile) {
        try {
          const { url } = await uploadDocumento(id, ventaFile)
          docUrl = url
        } catch (err) {
          console.error('Error al subir documento:', err)
          setVentaDocFailed(true)
        }
      }
      const nueva = await createAdditionalSale({
        project_id:    id,
        descripcion:   ventaDesc.trim(),
        monto:         parseInt(ventaMonto),
        documento_url: docUrl,
      })
      setAdditionalSales(prev => [nueva, ...prev])

      if (docUrl) {
        try {
          const nuevoDoc = await createDocumento({
            project_id: id,
            tipo: 'comprobante',
            nombre: ventaFileName || ventaDesc.trim(),
            archivo_url: docUrl,
            fecha: new Date().toISOString().split('T')[0],
          })
          setDocs(prev => [nuevoDoc, ...prev])
        } catch (err) {
          console.error('Error al registrar documento en Biblioteca:', err)
        }
      }

      setShowAddVenta(false)
      setVentaDesc(''); setVentaMonto(''); setVentaFile(null); setVentaFileName(null)
    } catch (err) {
      setVentaError(err.message || 'Error al guardar')
    } finally {
      setVentaSaving(false)
    }
  }

  const handleDeleteVenta = async (ventaId) => {
    try {
      await deleteAdditionalSale(ventaId)
      setAdditionalSales(prev => prev.filter(v => v.id !== ventaId))
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmDeleteVentaId(null)
    }
  }

  const openEditGasto = (gasto) => {
    setEditGasto(gasto)
    setEditGastoForm({
      monto:      String(gasto.monto ?? ''),
      categoria:  gasto.categoria ?? 'materiales',
      proveedor:  gasto.proveedor ?? '',
      fecha:      gasto.fecha ?? '',
      medio_pago: gasto.medio_pago ?? 'contado',
      comentario: gasto.comentario ?? '',
    })
    setEditGastoError('')
  }

  const handleSaveGasto = async () => {
    if (!editGastoForm.monto || !editGastoForm.proveedor) { setEditGastoError('Completa monto y proveedor'); return }
    setEditGastoSaving(true)
    setEditGastoError('')
    try {
      const updated = await updateGasto(editGasto.id, {
        monto:      parseInt(editGastoForm.monto),
        categoria:  editGastoForm.categoria,
        proveedor:  editGastoForm.proveedor,
        fecha:      editGastoForm.fecha,
        medio_pago: editGastoForm.medio_pago,
        comentario: editGastoForm.comentario || null,
      })
      setGastos(prev => prev.map(g => g.id === editGasto.id ? { ...g, ...updated } : g))
      setEditGasto(null)
    } catch (err) {
      setEditGastoError(err.message || 'Error al guardar')
    } finally {
      setEditGastoSaving(false)
    }
  }

  const handleDeleteGasto = async (gastoId) => {
    setDeletingGasto(true)
    try {
      await deleteGasto(gastoId)
      setGastos(prev => prev.filter(g => g.id !== gastoId))
      setConfirmDelGasto(null)
    } catch { /* silencioso */ } finally { setDeletingGasto(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  if (!obra) return (
    <div className="text-center py-20">
      <p style={{ color: 'var(--muted)' }}>Obra no encontrada</p>
      <button onClick={() => navigate('/obras')} className="btn-secondary mt-4 mx-auto">Volver</button>
    </div>
  )

  // ── Cálculos financieros ────────────────────────────────────
  // Excluir GAV de la vista de obra (son gastos generales de empresa, no de esta obra)
  const gastosObra       = gastos.filter(g => CATEGORIAS_GASTO[g.categoria]?.grupo !== 'Gastos Generales')

  const ventaAprobada    = obra.presupuesto ?? 0
  const ventaAdicional   = additionalSales.reduce((s, v) => s + (v.monto ?? 0), 0)
  const ventaTotal       = ventaAprobada + ventaAdicional
  const abonosRealizados = ingresos.reduce((s, i) => s + (i.monto ?? 0), 0)
  const faltante         = ventaTotal - abonosRealizados
  const pctAbonado       = ventaTotal > 0 ? Math.min((abonosRealizados / ventaTotal) * 100, 100).toFixed(0) : 0

  const costoDirecto     = gastosObra
    .filter(g => CATEGORIAS_GASTO[g.categoria]?.grupo === 'Costo Directo de la Obra')
    .reduce((s, g) => s + (g.monto ?? 0), 0)
  const manoObra         = asistencia.reduce((s, r) => s + (r.costo_total ?? 0), 0)
  const totalGastos      = gastosObra.reduce((s, g) => s + (g.monto ?? 0), 0)
  const margenPlata      = ventaTotal - costoDirecto - manoObra
  const pctMargen        = ventaTotal > 0 ? (margenPlata / ventaTotal * 100).toFixed(1) : 0

  const sobrecosto       = ventaTotal > 0 && totalGastos > ventaTotal

  const gastosCat = gastosObra.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + (g.monto ?? 0)
    return acc
  }, {})

  // Tabla combinada: gastos (sin GAV) + abonos ordenados por fecha desc
  const movimientos = [
    ...gastosObra.map(g => ({
      id:    g.id,
      tipo:  'gasto',
      fecha: g.fecha,
      desc:  g.proveedor,
      sub:   CATEGORIAS_GASTO[g.categoria]?.label ?? g.categoria,
      monto: g.monto ?? 0,
      color: CATEGORIAS_GASTO[g.categoria]?.color ?? '#64748B',
    })),
    ...ingresos.map(i => ({
      id:    i.id,
      tipo:  'abono',
      fecha: i.fecha,
      desc:  i.descripcion || 'Abono',
      sub:   null,
      monto: i.monto ?? 0,
      color: null,
    })),
  ].sort((a, b) => {
    if (!a.fecha) return 1
    if (!b.fecha) return -1
    return b.fecha.localeCompare(a.fecha)
  })

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────── */}
      <div>
        <button onClick={() => navigate('/obras')} className="btn-ghost mb-4 -ml-1 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={15} /> Volver a obras
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {obra.tipo   && <Badge className={TIPOS_OBRA[obra.tipo]?.color}>{TIPOS_OBRA[obra.tipo]?.label}</Badge>}
              {obra.estado && <Badge className={ESTADOS_OBRA[obra.estado]?.color}>{ESTADOS_OBRA[obra.estado]?.label}</Badge>}
            </div>
            <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{obra.nombre}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{obra.clients?.nombre ?? '—'}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={openEdit} className="btn-secondary text-sm">
              <Pencil size={14} /> Editar
            </button>
            <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary text-sm">
              <Plus size={15} /> Gasto
            </button>
          </div>
        </div>
      </div>

      {/* ── Cobro ────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} style={{ color: 'var(--amber)' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>Venta Total</p>
          </div>
          <p className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>
            {ventaTotal > 0 ? formatCLP(ventaTotal) : '—'}
          </p>
          {ventaAdicional > 0 && (
            <p className="text-xs mt-1 num" style={{ color: 'var(--subtle)' }}>
              Base {formatCLP(ventaAprobada)} + {formatCLP(ventaAdicional)}
            </p>
          )}
          {ventaTotal > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span style={{ color: 'var(--muted)' }}>Abonado</span>
                <span className="num font-semibold" style={{ color: 'var(--amber)' }}>{pctAbonado}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pctAbonado}%`, background: 'var(--amber)', boxShadow: '0 0 8px var(--amber-glow)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={13} style={{ color: 'var(--green)' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>Abonos Realizados</p>
          </div>
          <p className="font-display font-bold text-2xl" style={{ color: 'var(--green)' }}>
            {formatCLP(abonosRealizados)}
          </p>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            {ingresos.length} {ingresos.length === 1 ? 'cobro registrado' : 'cobros registrados'}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} style={{ color: faltante > 0 ? 'var(--amber)' : faltante < 0 ? 'var(--red)' : 'var(--green)' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>Saldo Pendiente</p>
          </div>
          <p className="font-display font-bold text-2xl" style={{
            color: faltante > 0 ? 'var(--amber)' : faltante < 0 ? 'var(--red)' : 'var(--green)'
          }}>
            {ventaAprobada > 0 ? formatCLP(Math.abs(faltante)) : '—'}
          </p>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            {faltante > 0 ? 'Pendiente de cobro' : faltante < 0 ? 'Excede venta aprobada' : 'Cobro completo ✓'}
          </p>
        </div>
      </div>

      {/* ── Gastos / Margen ───────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-5 overflow-visible">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>Total Gastos</p>
            <span className="relative group inline-flex cursor-default">
              <Info size={12} style={{ color: 'var(--subtle)' }} />
              <span
                className="absolute left-1/2 -translate-x-1/2 top-5 z-50 w-52 px-3 py-2 rounded-xl text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'Instrument Sans', lineHeight: 1.5 }}
              >
                Gastos directos de la obra: materiales, subcontratos y mano de obra
              </span>
            </span>
          </div>
          <p className="font-display font-bold text-2xl" style={{ color: sobrecosto ? 'var(--red)' : 'var(--text)' }}>{formatCLP(costoDirecto + manoObra)}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{gastosObra.length} gastos registrados</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>Margen</p>
          <p className="font-display font-bold text-2xl" style={{
            color: margenPlata > 0 ? (parseFloat(pctMargen) >= 20 ? 'var(--green)' : 'var(--amber)') : 'var(--red)'
          }}>
            {ventaAprobada > 0 ? formatCLP(margenPlata) : '—'}
          </p>
          <p className="text-xs mt-2 num" style={{ color: 'var(--muted)' }}>
            {ventaAprobada > 0 ? 'Venta − CDO − MO' : 'Sin venta aprobada'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.08em' }}>% Margen</p>
          <p className="font-display font-bold text-2xl num" style={{
            color: ventaAprobada > 0
              ? (parseFloat(pctMargen) >= 20 ? 'var(--green)' : parseFloat(pctMargen) > 0 ? 'var(--amber)' : 'var(--red)')
              : 'var(--subtle)'
          }}>
            {ventaAprobada > 0 ? `${pctMargen}%` : '—'}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {ventaAprobada > 0
              ? (parseFloat(pctMargen) >= 20 ? 'Margen saludable' : parseFloat(pctMargen) > 0 ? 'Margen ajustado' : 'Margen negativo')
              : 'Sin venta aprobada'}
          </p>
        </div>
      </div>

      {/* ── Ventas Adicionales ───────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: additionalSales.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <div>
            <h2 className="section-title">Ventas Adicionales</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Extra-contratos y ampliaciones de obra</p>
          </div>
          <button
            onClick={() => { setVentaDesc(''); setVentaMonto(''); setVentaFile(null); setVentaFileName(null); setVentaError(''); setVentaDocFailed(false); setShowAddVenta(true) }}
            className="btn-secondary text-sm"
            style={{ color: 'var(--amber)', borderColor: 'rgba(255,149,0,0.3)' }}
          >
            <Plus size={13} /> Agregar
          </button>
        </div>

        {ventaDocFailed && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg flex items-center justify-between gap-2" style={{ color: 'var(--red)', background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.25)' }}>
            <p className="text-[12px]">⚠ La venta se guardó, pero el documento no se pudo adjuntar. Intenta subirlo de nuevo más tarde.</p>
            <button onClick={() => setVentaDocFailed(false)} className="flex-shrink-0"><X size={13} /></button>
          </div>
        )}

        {additionalSales.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {additionalSales.map(v => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{v.descripcion}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-sm font-semibold" style={{ color: 'var(--amber)' }}>+{formatCLP(v.monto)}</span>
                  {confirmDeleteVentaId === v.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                      <button
                        onClick={() => handleDeleteVenta(v.id)}
                        className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                      >Sí</button>
                      <button
                        onClick={() => setConfirmDeleteVentaId(null)}
                        className="p-1 rounded-lg"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteVentaId(v.id)}
                      className="p-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                      title="Eliminar venta adicional"
                    >
                      <Trash2 size={11} style={{ color: 'var(--red)' }} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--bg-surface)' }}>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--muted)', fontFamily: 'Unbounded', letterSpacing: '0.06em' }}>Total adicional</span>
              <span className="num text-sm font-bold" style={{ color: 'var(--amber)' }}>{formatCLP(ventaAdicional)}</span>
            </div>
          </div>
        )}

        {additionalSales.length === 0 && !showAddVenta && (
          <div className="px-5 py-4">
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>Sin ventas adicionales registradas</p>
          </div>
        )}
      </div>

      {/* ── Gastos por categoría ─────────────────── */}
      {Object.keys(gastosCat).length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(gastosCat).map(([cat, monto]) => {
              const info = CATEGORIAS_GASTO[cat]
              const pct  = totalGastos > 0 ? (monto / totalGastos * 100).toFixed(0) : 0
              return (
                <div key={cat} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{info?.label ?? cat}</span>
                    <span className="text-xs font-semibold" style={{ color: info?.color }}>{pct}%</span>
                  </div>
                  <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{formatCLP(monto)}</p>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: info?.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Registro de Gastos y Abonos ──────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Registro de Gastos y Abonos</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAbono(true); setAbonoError('') }}
              className="btn-secondary text-sm"
              style={{ color: 'var(--green)', borderColor: 'rgba(0,196,140,0.3)' }}
            >
              <Plus size={14} /> Abono
            </button>
            <button onClick={() => navigate('/gastos/nuevo')} className="btn-ghost text-sm" style={{ color: 'var(--amber)' }}>
              <Plus size={14} /> Gasto
            </button>
          </div>
        </div>

        {movimientos.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--subtle)' }}>Sin movimientos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  {['Tipo', 'Descripción', 'Monto', 'Fecha', ''].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left"
                      style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={`${m.tipo}-${m.id}`} className="table-row">
                    <td className="px-5 py-3.5">
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-lg"
                        style={{
                          fontFamily: 'Unbounded',
                          background: m.tipo === 'abono' ? 'rgba(0,196,140,0.12)' : 'rgba(255,69,96,0.1)',
                          color:      m.tipo === 'abono' ? 'var(--green)' : 'var(--red)',
                          border:     `1px solid ${m.tipo === 'abono' ? 'rgba(0,196,140,0.25)' : 'rgba(255,69,96,0.2)'}`,
                        }}
                      >
                        {m.tipo === 'abono' ? 'ABONO' : 'GASTO'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {m.tipo === 'gasto' && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                        )}
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.desc}</p>
                          {m.sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.sub}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-sm font-semibold" style={{
                        color: m.tipo === 'abono' ? 'var(--green)' : 'var(--text)'
                      }}>
                        {m.tipo === 'abono' ? '+' : ''}{formatCLP(m.monto)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-xs" style={{ color: 'var(--muted)' }}>{formatDate(m.fecha)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {m.tipo === 'gasto' && (
                        confirmDelGasto === m.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                            <button
                              onClick={() => handleDeleteGasto(m.id)}
                              disabled={deletingGasto}
                              className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                              style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)', opacity: deletingGasto ? 0.5 : 1 }}
                            >{deletingGasto ? '...' : 'Sí'}</button>
                            <button
                              onClick={() => setConfirmDelGasto(null)}
                              className="p-1 rounded-lg"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                            ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditGasto(gastos.find(g => g.id === m.id))}
                              className="p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                              title="Editar egreso"
                            >
                              <Pencil size={13} style={{ color: 'var(--muted)' }} />
                            </button>
                            <button
                              onClick={() => setConfirmDelGasto(m.id)}
                              className="p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                              title="Eliminar egreso"
                            >
                              <Trash2 size={13} style={{ color: 'var(--red)' }} />
                            </button>
                          </div>
                        )
                      )}
                      {m.tipo === 'abono' && (
                        confirmDeleteId === m.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                            <button
                              onClick={() => handleDeleteAbono(m.id)}
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditAbono(ingresos.find(i => i.id === m.id))}
                              className="p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                              title="Editar abono"
                            >
                              <Pencil size={13} style={{ color: 'var(--muted)' }} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="p-1.5 rounded-lg transition-all hover:opacity-80"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                              title="Eliminar abono"
                            >
                              <Trash2 size={13} style={{ color: 'var(--red)' }} />
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Documentos ───────────────────────────── */}
      {docs.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Documentos ({docs.length})</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {docs.map(d => {
              const info = TIPOS_DOC[d.tipo]
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors group" style={{ background: 'var(--bg-surface)' }}>
                  <span className="text-xl">{info?.icon ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(d.fecha)}{d.tamaño ? ` · ${d.tamaño}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {info && <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>}
                    {d.archivo_url && (
                      <>
                        <a href={d.archivo_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center ml-2" style={{ background: 'var(--bg-card)' }}>
                          <Eye size={13} style={{ color: 'var(--muted)' }} />
                        </a>
                        <a href={d.archivo_url} download className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
                          <Download size={13} style={{ color: 'var(--muted)' }} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal: Editar obra ────────────────────── */}
      {editForm && (
        <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Editar Obra" size="lg">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nombre de la obra *</label>
              <input className="input" value={editForm.nombre}
                onChange={e => { setEditForm(p => ({ ...p, nombre: e.target.value })); setEditError('') }} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input className="input" value={editForm.direccion}
                onChange={e => setEditForm(p => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo de obra</label>
              <select className="select" value={editForm.tipo} onChange={e => setEditForm(p => ({ ...p, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t} value={t}>{TIPOS_OBRA[t]?.label ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="select" value={editForm.estado} onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{ESTADOS_OBRA[s]?.label ?? s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha inicio</label>
              <input type="date" className="input" value={editForm.fecha_inicio}
                onChange={e => setEditForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha estimada término</label>
              <input type="date" className="input" value={editForm.fecha_termino}
                onChange={e => setEditForm(p => ({ ...p, fecha_termino: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Venta Aprobada (CLP)</label>
              <input type="number" className="input num" value={editForm.presupuesto}
                onChange={e => setEditForm(p => ({ ...p, presupuesto: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descripción</label>
              <textarea className="input resize-none" rows={3} value={editForm.descripcion}
                onChange={e => setEditForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
          </div>
          {editError && (
            <div className="flex items-center gap-2 mt-3">
              <AlertCircle size={13} style={{ color: 'var(--red)' }} />
              <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)', letterSpacing: '0.06em' }}>
                {editError.toUpperCase()}
              </p>
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowEdit(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !editForm.nombre}
              className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Editar abono ──────────────────── */}
      <Modal open={!!editAbono} onClose={() => { setEditAbono(null); setEditAbonoError('') }} title="Editar Abono">
        <div className="space-y-4">
          <div>
            <label className="label">Monto (CLP) *</label>
            <input
              type="number"
              className="input num text-2xl"
              style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500 }}
              placeholder="0"
              value={editAbonoMonto}
              onChange={e => { setEditAbonoMonto(e.target.value); setEditAbonoError('') }}
              autoFocus
            />
            {editAbonoMonto && parseInt(editAbonoMonto) > 0 && (
              <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--green)' }}>
                {formatCLP(parseInt(editAbonoMonto))}
              </p>
            )}
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={editAbonoFecha}
              onChange={e => setEditAbonoFecha(e.target.value)} />
          </div>
          <div>
            <label className="label">Descripción <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
            <input className="input" placeholder="Ej: Anticipo 30%, Estado de pago 1..."
              value={editAbonoDesc} onChange={e => setEditAbonoDesc(e.target.value)} />
          </div>
        </div>
        {editAbonoError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{editAbonoError}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setEditAbono(null); setEditAbonoError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={handleGuardarAbono} disabled={editAbonoSaving || !editAbonoMonto}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            {editAbonoSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
            {editAbonoSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Venta Adicional ───────────────────── */}
      <Modal open={showAddVenta} onClose={() => { setShowAddVenta(false); setVentaError('') }} title="Venta Adicional">
        <input ref={ventaFileRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setVentaFile(f); setVentaFileName(f.name) } }} />
        <div className="space-y-4">
          <div>
            <label className="label">Descripción *</label>
            <input
              className="input"
              placeholder="Ej: Extra pavimentación, Ampliación terraza..."
              value={ventaDesc}
              onChange={e => { setVentaDesc(e.target.value); setVentaError('') }}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Monto (CLP) *</label>
            <input
              type="number"
              className="input num"
              style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500 }}
              placeholder="0"
              value={ventaMonto}
              onChange={e => { setVentaMonto(e.target.value); setVentaError('') }}
            />
            {ventaMonto && parseInt(ventaMonto) > 0 && (
              <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--amber)' }}>{formatCLP(parseInt(ventaMonto))}</p>
            )}
          </div>
          <div>
            <label className="label">Documento <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
            {ventaFileName ? (
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span className="text-lg">📎</span>
                <p className="text-sm flex-1 truncate font-medium" style={{ color: 'var(--text)' }}>{ventaFileName}</p>
                <button onClick={() => { setVentaFile(null); setVentaFileName(null) }} style={{ color: 'var(--muted)' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => ventaFileRef.current?.click()}
                className="rounded-xl p-6 text-center cursor-pointer transition-all"
                style={{ border: '2px dashed var(--border)', background: 'var(--bg-surface)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,149,0,0.3)'; e.currentTarget.style.background = 'var(--amber-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                <Upload size={20} className="mx-auto mb-2" style={{ color: 'var(--subtle)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Subir factura, cotización o foto</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--subtle)' }}>PDF, JPG, PNG</p>
              </div>
            )}
            <button onClick={() => ventaFileRef.current?.click()} className="btn-secondary w-full justify-center mt-2 text-sm">
              <Camera size={13} /> Tomar foto
            </button>
          </div>
        </div>
        {ventaError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{ventaError}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setShowAddVenta(false); setVentaError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button
            onClick={handleAgregarVenta}
            disabled={ventaSaving || !ventaDesc || !ventaMonto}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--amber)' }}
          >
            {ventaSaving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><CheckCircle2 size={15} /> Guardar venta</>}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Editar gasto ──────────────────────── */}
      <Modal open={!!editGasto} onClose={() => { setEditGasto(null); setEditGastoError('') }} title="Editar Egreso">
        {editGasto && (
          <div className="space-y-4">
            <div>
              <label className="label">Monto (CLP) *</label>
              <input
                type="number"
                className="input num"
                style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500 }}
                placeholder="0"
                value={editGastoForm.monto}
                onChange={e => setEditGastoForm(p => ({ ...p, monto: e.target.value }))}
                autoFocus
              />
              {editGastoForm.monto && parseInt(editGastoForm.monto) > 0 && (
                <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--amber)' }}>{formatCLP(parseInt(editGastoForm.monto))}</p>
              )}
            </div>
            <div>
              <label className="label">Categoría</label>
              <select
                className="select"
                value={editGastoForm.categoria}
                onChange={e => setEditGastoForm(p => ({ ...p, categoria: e.target.value }))}
              >
                {Object.entries(CATEGORIAS_GASTO).filter(([, v]) => !v.auto).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Proveedor *</label>
              <input
                className="input"
                value={editGastoForm.proveedor}
                onChange={e => setEditGastoForm(p => ({ ...p, proveedor: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={editGastoForm.fecha}
                onChange={e => setEditGastoForm(p => ({ ...p, fecha: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Medio de pago</label>
              <div className="flex gap-2 mt-1">
                {[{ value: 'contado', label: 'Al Contado' }, { value: 'credito', label: 'Crédito' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditGastoForm(p => ({ ...p, medio_pago: opt.value }))}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: editGastoForm.medio_pago === opt.value ? 'var(--amber)' : 'var(--bg-surface)',
                      color:      editGastoForm.medio_pago === opt.value ? '#000' : 'var(--muted)',
                      border:     `1px solid ${editGastoForm.medio_pago === opt.value ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Comentario</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Descripción..."
                value={editGastoForm.comentario}
                onChange={e => setEditGastoForm(p => ({ ...p, comentario: e.target.value }))}
              />
            </div>
          </div>
        )}
        {editGastoError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{editGastoError}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setEditGasto(null); setEditGastoError('') }} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button
            onClick={handleSaveGasto}
            disabled={editGastoSaving}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editGastoSaving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><Pencil size={15} /> Guardar cambios</>}
          </button>
        </div>
      </Modal>

      {/* ── Modal: Agregar abono ──────────────────── */}
      <Modal open={showAbono} onClose={() => { setShowAbono(false); setAbonoError('') }} title="Agregar Abono">
        <div className="space-y-4">
          <div>
            <label className="label">Monto (CLP) *</label>
            <input
              type="number"
              className="input num text-2xl"
              style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500 }}
              placeholder="0"
              value={abonoMonto}
              onChange={e => { setAbonoMonto(e.target.value); setAbonoError('') }}
              autoFocus
            />
            {abonoMonto && parseInt(abonoMonto) > 0 && (
              <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--green)' }}>
                {formatCLP(parseInt(abonoMonto))}
              </p>
            )}
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={abonoFecha}
              onChange={e => setAbonoFecha(e.target.value)} />
          </div>
          <div>
            <label className="label">Descripción <span style={{ color: 'var(--subtle)' }}>(opcional)</span></label>
            <input className="input" placeholder="Ej: Anticipo 30%, Estado de pago 1..."
              value={abonoDesc} onChange={e => setAbonoDesc(e.target.value)} />
          </div>
        </div>
        {abonoError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{abonoError}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setShowAbono(false); setAbonoError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={handleAgregarAbono} disabled={abonoSaving || !abonoMonto}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--green)' }}>
            {abonoSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {abonoSaving ? 'Guardando...' : 'Registrar Abono'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
