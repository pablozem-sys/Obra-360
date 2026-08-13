import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronRight, Search, History, X, AlertCircle,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { formatCLP, formatDate, ESTADOS_COTIZACION, ESTADOS_LINEA, REGIMENES_IVA } from '../../lib/helpers'
import {
  getCotizacionCompleta, getCatalogo, getCotizadorConfig, getHistorialPrecio, registrarHistorialPrecio,
  createCapitulo, updateCapitulo, deleteCapitulo,
  createSubBloque, updateSubBloque, deleteSubBloque,
  createLinea, updateLinea, deleteLinea,
} from '../../lib/cotizador/api'
import { calcularLinea, calcularSubtotalNeto, lineasFirmesSinPrecio } from '../../lib/cotizador/calculo'

const LINEA_INICIAL = { partida_id: null, descripcion: '', unidad: '', cantidad: 1, costo_unit_catalogo: null, costo_unit_usado: 0, estado: 'firme' }

export default function CotizadorBuilder() {
  const { id } = useParams()
  const { user } = useAuth()
  const [cotizacion, setCotizacion] = useState(null)
  const [catalogo, setCatalogo] = useState([])
  const [config, setConfig] = useState({ iva_pct: 19, iva_obra_factor: 0.5 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [capExpandido, setCapExpandido] = useState(new Set())

  // Selector de partida: { subBloqueId } cuando está abierto para agregar una línea nueva
  const [selectorPartida, setSelectorPartida] = useState(null)
  // Override de precio pendiente de motivo: { lineaId, valorNuevo, partidaId, costoCatalogo }
  const [overridePendiente, setOverridePendiente] = useState(null)

  const cargar = useCallback(async () => {
    const [cot, cat, cfg] = await Promise.all([
      getCotizacionCompleta(id),
      getCatalogo(),
      getCotizadorConfig(),
    ])
    setCotizacion(cot)
    setCatalogo(cat)
    setConfig(cfg)
    setCapExpandido(new Set(cot.capitulo.map((c) => c.id)))
  }, [id])

  useEffect(() => {
    setLoading(true)
    cargar().catch((err) => setError(err.message || 'Error al cargar la cotización')).finally(() => setLoading(false))
  }, [cargar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
      </div>
    )
  }

  if (error || !cotizacion) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--red)' }} />
        <p style={{ color: 'var(--muted)' }}>{error || 'Cotización no encontrada'}</p>
      </div>
    )
  }

  // ── Cálculo en vivo (motor de la Etapa 4) ────────────────────────
  const todasLasLineas = cotizacion.capitulo.flatMap((cap) =>
    cap.sub_bloque.flatMap((sb) =>
      sb.linea.map((l) => {
        if (l.costo_unit_usado == null) return { ...l, totalLinea: 0 }
        const { precioUnitario, totalLinea } = calcularLinea({
          costoUnitario: l.costo_unit_usado,
          margenPct: cap.margen_pct ?? 0,
          cantidad: l.cantidad,
        })
        return { ...l, precioUnitario, totalLinea }
      })
    )
  )
  const totalCotizacion = calcularSubtotalNeto(todasLasLineas)
  const lineasSinPrecio = lineasFirmesSinPrecio(
    todasLasLineas.map((l) => ({ ...l, costoUnitario: l.costo_unit_usado }))
  )

  const netoCapitulo = (cap) => {
    const lineas = cap.sub_bloque.flatMap((sb) => sb.linea)
    return calcularSubtotalNeto(
      lineas.map((l) => {
        const found = todasLasLineas.find((x) => x.id === l.id)
        return found ?? { ...l, totalLinea: 0, estado: l.estado }
      })
    )
  }

  const toggleCap = (capId) => {
    setCapExpandido((prev) => {
      const next = new Set(prev)
      if (next.has(capId)) next.delete(capId); else next.add(capId)
      return next
    })
  }

  // ── Capítulo ──────────────────────────────────────────────────
  const handleAddCapitulo = async () => {
    const nuevo = await createCapitulo({
      cotizacion_id: id,
      orden: cotizacion.capitulo.length,
      nombre: 'Nuevo capítulo',
      margen_pct: 0,
      regimen_iva: 'obra',
    })
    setCotizacion((c) => ({ ...c, capitulo: [...c.capitulo, { ...nuevo, sub_bloque: [] }] }))
    setCapExpandido((prev) => new Set(prev).add(nuevo.id))
  }

  const handleUpdateCapitulo = async (capId, updates) => {
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cap) => (cap.id === capId ? { ...cap, ...updates } : cap)),
    }))
    await updateCapitulo(capId, updates)
  }

  const handleDeleteCapitulo = async (capId) => {
    if (!confirm('¿Eliminar este capítulo y todo su contenido?')) return
    await deleteCapitulo(capId)
    setCotizacion((c) => ({ ...c, capitulo: c.capitulo.filter((cap) => cap.id !== capId) }))
  }

  // ── Sub-bloque ────────────────────────────────────────────────
  const handleAddSubBloque = async (capId) => {
    const cap = cotizacion.capitulo.find((c) => c.id === capId)
    const nuevo = await createSubBloque({ capitulo_id: capId, orden: cap.sub_bloque.length, nombre: 'Nuevo sub-bloque' })
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => (cp.id === capId ? { ...cp, sub_bloque: [...cp.sub_bloque, { ...nuevo, linea: [] }] } : cp)),
    }))
  }

  const handleUpdateSubBloque = async (capId, sbId, updates) => {
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => cp.id !== capId ? cp : {
        ...cp,
        sub_bloque: cp.sub_bloque.map((sb) => (sb.id === sbId ? { ...sb, ...updates } : sb)),
      }),
    }))
    await updateSubBloque(sbId, updates)
  }

  const handleDeleteSubBloque = async (capId, sbId) => {
    if (!confirm('¿Eliminar este sub-bloque y sus líneas?')) return
    await deleteSubBloque(sbId)
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => cp.id !== capId ? cp : { ...cp, sub_bloque: cp.sub_bloque.filter((sb) => sb.id !== sbId) }),
    }))
  }

  // ── Línea ─────────────────────────────────────────────────────
  const patchLinea = (capId, sbId, lineaId, updates) => {
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => cp.id !== capId ? cp : {
        ...cp,
        sub_bloque: cp.sub_bloque.map((sb) => sb.id !== sbId ? sb : {
          ...sb,
          linea: sb.linea.map((l) => (l.id === lineaId ? { ...l, ...updates } : l)),
        }),
      }),
    }))
  }

  const handleAddLinea = async (capId, sbId, datos) => {
    const cap = cotizacion.capitulo.find((c) => c.id === capId)
    const sb = cap.sub_bloque.find((s) => s.id === sbId)
    const nueva = await createLinea({
      sub_bloque_id: sbId,
      orden: sb.linea.length,
      ...LINEA_INICIAL,
      ...datos,
    })
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => cp.id !== capId ? cp : {
        ...cp,
        sub_bloque: cp.sub_bloque.map((s) => (s.id === sbId ? { ...s, linea: [...s.linea, nueva] } : s)),
      }),
    }))
    setSelectorPartida(null)
  }

  const handleUpdateLineaField = async (capId, sbId, lineaId, field, value) => {
    patchLinea(capId, sbId, lineaId, { [field]: value })
    await updateLinea(lineaId, { [field]: value })
  }

  const handleDeleteLinea = async (capId, sbId, lineaId) => {
    await deleteLinea(lineaId)
    setCotizacion((c) => ({
      ...c,
      capitulo: c.capitulo.map((cp) => cp.id !== capId ? cp : {
        ...cp,
        sub_bloque: cp.sub_bloque.map((sb) => sb.id !== sbId ? sb : { ...sb, linea: sb.linea.filter((l) => l.id !== lineaId) }),
      }),
    }))
  }

  // Override de costo: si la línea viene de catálogo y el valor difiere del
  // costo de catálogo, pide motivo y deja rastro en historial_precio
  // (spec sección 4 regla 3).
  const handleCostoBlur = (capId, sbId, linea, nuevoValor) => {
    const valor = nuevoValor === '' ? null : Number(nuevoValor)
    if (valor === linea.costo_unit_usado) return
    if (linea.partida_id && valor !== linea.costo_unit_catalogo) {
      setOverridePendiente({ capId, sbId, linea, valor, motivo: '' })
    } else {
      handleUpdateLineaField(capId, sbId, linea.id, 'costo_unit_usado', valor)
    }
  }

  const confirmarOverride = async () => {
    const { capId, sbId, linea, valor, motivo } = overridePendiente
    await handleUpdateLineaField(capId, sbId, linea.id, 'costo_unit_usado', valor)
    await updateLinea(linea.id, { motivo_override: motivo || null })
    patchLinea(capId, sbId, linea.id, { motivo_override: motivo || null })
    await registrarHistorialPrecio({
      partidaId: linea.partida_id, cotizacionId: id, precio: valor, usuario: user?.id ?? null, motivo,
    })
    setOverridePendiente(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={ESTADOS_COTIZACION[cotizacion.estado]?.color}>
                {ESTADOS_COTIZACION[cotizacion.estado]?.label ?? cotizacion.estado}
              </Badge>
              {lineasSinPrecio.length > 0 && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--red)', fontFamily: 'DM Mono' }}>
                  <AlertCircle size={12} /> {lineasSinPrecio.length} línea(s) firme sin precio
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {cotizacion.nombre_obra}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {cotizacion.cliente_nombre} · {formatDate(cotizacion.fecha)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>Neto total</p>
            <p className="num text-2xl font-bold" style={{ color: 'var(--text)' }}>{formatCLP(totalCotizacion)}</p>
          </div>
        </div>
      </div>

      {/* Capítulos */}
      <div className="space-y-3">
        {cotizacion.capitulo.map((cap) => (
          <CapituloCard
            key={cap.id}
            capitulo={cap}
            expandido={capExpandido.has(cap.id)}
            onToggle={() => toggleCap(cap.id)}
            neto={netoCapitulo(cap)}
            onUpdate={(updates) => handleUpdateCapitulo(cap.id, updates)}
            onDelete={() => handleDeleteCapitulo(cap.id)}
            onAddSubBloque={() => handleAddSubBloque(cap.id)}
            onUpdateSubBloque={(sbId, updates) => handleUpdateSubBloque(cap.id, sbId, updates)}
            onDeleteSubBloque={(sbId) => handleDeleteSubBloque(cap.id, sbId)}
            onAbrirSelectorPartida={(sbId) => setSelectorPartida({ capId: cap.id, sbId })}
            onUpdateLineaField={(sbId, lineaId, field, value) => handleUpdateLineaField(cap.id, sbId, lineaId, field, value)}
            onCostoBlur={(sbId, linea, valor) => handleCostoBlur(cap.id, sbId, linea, valor)}
            onDeleteLinea={(sbId, lineaId) => handleDeleteLinea(cap.id, sbId, lineaId)}
            lineasCalculadas={todasLasLineas}
          />
        ))}

        <button onClick={handleAddCapitulo} className="btn-secondary text-sm w-full justify-center py-3">
          <Plus size={15} /> Agregar capítulo
        </button>
      </div>

      {/* Selector de partida (Etapa 6: agregar línea + histórico de precios) */}
      <SelectorPartidaModal
        open={!!selectorPartida}
        onClose={() => setSelectorPartida(null)}
        catalogo={catalogo}
        onSeleccionar={(datos) => handleAddLinea(selectorPartida.capId, selectorPartida.sbId, datos)}
      />

      {/* Motivo del override de precio */}
      <Modal open={!!overridePendiente} onClose={() => setOverridePendiente(null)} title="Cambiar precio de referencia" size="sm">
        {overridePendiente && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              El catálogo sugiere <strong style={{ color: 'var(--text)' }}>{formatCLP(overridePendiente.linea.costo_unit_catalogo)}</strong>,
              vas a usar <strong style={{ color: 'var(--text)' }}>{formatCLP(overridePendiente.valor)}</strong>.
            </p>
            <div>
              <label className="label">Motivo (opcional)</label>
              <input
                className="input"
                placeholder="Ej: valor proforma"
                value={overridePendiente.motivo}
                onChange={(e) => setOverridePendiente((p) => ({ ...p, motivo: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setOverridePendiente(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={confirmarOverride} className="btn-primary flex-1 justify-center">Confirmar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function CapituloCard({
  capitulo, expandido, onToggle, neto, onUpdate, onDelete,
  onAddSubBloque, onUpdateSubBloque, onDeleteSubBloque,
  onAbrirSelectorPartida, onUpdateLineaField, onCostoBlur, onDeleteLinea, lineasCalculadas,
}) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center gap-3" style={{ background: 'var(--bg-surface)' }}>
        <button onClick={onToggle} style={{ color: 'var(--muted)' }}>
          {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <input
          className="input flex-1 font-display font-semibold"
          value={capitulo.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <label className="text-[11px]" style={{ color: 'var(--subtle)' }}>Margen</label>
          <input
            type="number"
            className="input num w-20"
            value={capitulo.margen_pct ?? 0}
            onChange={(e) => onUpdate({ margen_pct: Number(e.target.value) })}
          />
          <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>%</span>
        </div>
        <select
          className="select w-40"
          value={capitulo.regimen_iva ?? 'obra'}
          onChange={(e) => onUpdate({ regimen_iva: e.target.value })}
        >
          {Object.entries(REGIMENES_IVA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <p className="num text-sm font-semibold w-32 text-right" style={{ color: 'var(--text)' }}>{formatCLP(neto)}</p>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--red)' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {expandido && (
        <div className="p-4 space-y-3">
          {capitulo.sub_bloque.map((sb) => (
            <SubBloqueCard
              key={sb.id}
              subBloque={sb}
              onUpdate={(updates) => onUpdateSubBloque(sb.id, updates)}
              onDelete={() => onDeleteSubBloque(sb.id)}
              onAbrirSelectorPartida={() => onAbrirSelectorPartida(sb.id)}
              onUpdateLineaField={(lineaId, field, value) => onUpdateLineaField(sb.id, lineaId, field, value)}
              onCostoBlur={(linea, valor) => onCostoBlur(sb.id, linea, valor)}
              onDeleteLinea={(lineaId) => onDeleteLinea(sb.id, lineaId)}
              lineasCalculadas={lineasCalculadas}
            />
          ))}
          <button onClick={onAddSubBloque} className="btn-ghost text-xs">
            <Plus size={13} /> Agregar sub-bloque
          </button>
        </div>
      )}
    </div>
  )
}

function SubBloqueCard({ subBloque, onUpdate, onDelete, onAbrirSelectorPartida, onUpdateLineaField, onCostoBlur, onDeleteLinea, lineasCalculadas }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <input
          className="input flex-1 text-sm py-1.5"
          value={subBloque.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
        />
        <button onClick={onDelete} className="p-1 rounded-lg hover:opacity-80" style={{ color: 'var(--red)' }}>
          <Trash2 size={12} />
        </button>
      </div>

      {subBloque.linea.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th className="font-normal px-1 pb-1.5">Descripción</th>
                <th className="font-normal px-1 pb-1.5 w-16">Unidad</th>
                <th className="font-normal px-1 pb-1.5 w-20">Cant.</th>
                <th className="font-normal px-1 pb-1.5 w-28">Costo</th>
                <th className="font-normal px-1 pb-1.5 w-28">Precio</th>
                <th className="font-normal px-1 pb-1.5 w-28">Total</th>
                <th className="font-normal px-1 pb-1.5 w-32">Estado</th>
                <th className="px-1 pb-1.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {subBloque.linea.map((l) => (
                <LineaRow
                  key={l.id}
                  linea={l}
                  calculada={lineasCalculadas.find((x) => x.id === l.id)}
                  onUpdateField={(field, value) => onUpdateLineaField(l.id, field, value)}
                  onCostoBlur={(valor) => onCostoBlur(l, valor)}
                  onDelete={() => onDeleteLinea(l.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={onAbrirSelectorPartida} className="btn-ghost text-xs mt-2">
        <Plus size={12} /> Agregar línea
      </button>
    </div>
  )
}

function LineaRow({ linea, calculada, onUpdateField, onCostoBlur, onDelete }) {
  const [costoLocal, setCostoLocal] = useState(linea.costo_unit_usado ?? '')
  const [verHistorico, setVerHistorico] = useState(false)
  const [historico, setHistorico] = useState(null)
  const sinPrecio = linea.estado === 'firme' && linea.costo_unit_usado == null
  const estadoInfo = ESTADOS_LINEA[linea.estado]

  const toggleHistorico = async () => {
    if (!verHistorico && !historico && linea.partida_id) {
      setHistorico(await getHistorialPrecio(linea.partida_id))
    }
    setVerHistorico((v) => !v)
  }

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)' }}>
        <td className="px-1 py-1.5">
          <input
            className="input py-1 text-sm w-full"
            value={linea.descripcion}
            onChange={(e) => onUpdateField('descripcion', e.target.value)}
          />
          {linea.motivo_override && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--amber)' }}>Override: {linea.motivo_override}</p>
          )}
        </td>
        <td className="px-1 py-1.5">
          <input className="input py-1 text-sm w-full" value={linea.unidad ?? ''} onChange={(e) => onUpdateField('unidad', e.target.value)} />
        </td>
        <td className="px-1 py-1.5">
          <input
            type="number"
            className="input num py-1 text-sm w-full"
            value={linea.cantidad}
            onChange={(e) => onUpdateField('cantidad', Number(e.target.value))}
          />
        </td>
        <td className="px-1 py-1.5">
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="input num py-1 text-sm w-full"
              style={sinPrecio ? { borderColor: 'var(--red)' } : undefined}
              placeholder="Sin precio"
              value={costoLocal}
              onChange={(e) => setCostoLocal(e.target.value)}
              onBlur={(e) => onCostoBlur(e.target.value)}
            />
            {linea.partida_id && (
              <button onClick={toggleHistorico} title="Ver histórico de precios" style={{ color: 'var(--subtle)' }}>
                <History size={13} />
              </button>
            )}
          </div>
        </td>
        <td className="px-1 py-1.5 num text-sm" style={{ color: 'var(--text)' }}>
          {calculada?.precioUnitario != null ? formatCLP(calculada.precioUnitario) : '—'}
        </td>
        <td className="px-1 py-1.5 num text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {formatCLP(calculada?.totalLinea ?? 0)}
        </td>
        <td className="px-1 py-1.5">
          <select className="select py-1 text-xs w-full" value={linea.estado} onChange={(e) => onUpdateField('estado', e.target.value)}>
            {Object.entries(ESTADOS_LINEA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </td>
        <td className="px-1 py-1.5">
          <button onClick={onDelete} style={{ color: 'var(--red)' }}><Trash2 size={13} /></button>
        </td>
      </tr>
      {verHistorico && (
        <tr>
          <td colSpan={8} className="px-1 pb-2">
            <div className="rounded-lg p-2 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {historico == null ? (
                <Loader2 size={12} className="animate-spin" />
              ) : historico.length === 0 ? (
                <p style={{ color: 'var(--subtle)' }}>Sin historial de precios para esta partida.</p>
              ) : (
                <ul className="space-y-1">
                  {historico.map((h, i) => (
                    <li key={i} className="flex justify-between" style={{ color: 'var(--muted)' }}>
                      <span>{h.cotizacion?.nombre_obra ?? '—'} · {formatDate(h.cotizacion?.fecha)}</span>
                      <span className="num" style={{ color: 'var(--text)' }}>{formatCLP(h.precio)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function SelectorPartidaModal({ open, onClose, catalogo, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState('')
  const [seleccionada, setSeleccionada] = useState(null)
  const [historico, setHistorico] = useState(null)

  useEffect(() => {
    if (!open) { setBusqueda(''); setSeleccionada(null); setHistorico(null) }
  }, [open])

  const filtradas = catalogo.filter((p) => p.descripcion.toLowerCase().includes(busqueda.toLowerCase()))

  const handleClickPartida = async (partida) => {
    setSeleccionada(partida)
    setHistorico(await getHistorialPrecio(partida.id))
  }

  const confirmarConPartida = () => {
    onSeleccionar({
      partida_id: seleccionada.id,
      descripcion: seleccionada.descripcion,
      unidad: seleccionada.unidad_sugerida,
      costo_unit_catalogo: seleccionada.costo_unitario_ref,
      costo_unit_usado: seleccionada.costo_unitario_ref,
      cantidad: 1,
    })
  }

  const confirmarSinPartida = () => {
    if (!busqueda.trim()) return
    onSeleccionar({ descripcion: busqueda.trim(), cantidad: 1, costo_unit_usado: null })
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar línea" size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
          <input
            autoFocus
            className="input pl-9"
            placeholder="Buscar en el catálogo..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setSeleccionada(null); setHistorico(null) }}
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          {filtradas.length === 0 ? (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--subtle)' }}>Sin resultados en el catálogo.</p>
          ) : (
            filtradas.map((p) => (
              <button
                key={p.id}
                onClick={() => handleClickPartida(p)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:opacity-80"
                style={{
                  background: seleccionada?.id === p.id ? 'var(--amber-dim)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text)' }}>{p.descripcion}</span>
                <span className="num flex-shrink-0 ml-3" style={{ color: 'var(--muted)' }}>
                  {p.unidad_sugerida ?? '—'} · {p.costo_unitario_ref != null ? formatCLP(p.costo_unitario_ref) : 'sin precio'}
                </span>
              </button>
            ))
          )}
        </div>

        {seleccionada && (
          <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Histórico de precios</p>
            {historico == null ? (
              <Loader2 size={12} className="animate-spin" />
            ) : historico.length === 0 ? (
              <p style={{ color: 'var(--subtle)' }}>Sin uso previo en otras obras.</p>
            ) : (
              <ul className="space-y-1">
                {historico.map((h, i) => (
                  <li key={i} className="flex justify-between" style={{ color: 'var(--muted)' }}>
                    <span>{h.cotizacion?.nombre_obra ?? '—'} · {formatDate(h.cotizacion?.fecha)}</span>
                    <span className="num" style={{ color: 'var(--text)' }}>{formatCLP(h.precio)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={confirmarSinPartida} disabled={!busqueda.trim() || seleccionada} className="btn-secondary flex-1 justify-center disabled:opacity-40">
            Agregar sin catálogo
          </button>
          <button onClick={confirmarConPartida} disabled={!seleccionada} className="btn-primary flex-1 justify-center disabled:opacity-40">
            <Plus size={14} /> Agregar del catálogo
          </button>
        </div>
      </div>
    </Modal>
  )
}
