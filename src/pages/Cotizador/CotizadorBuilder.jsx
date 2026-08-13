import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronRight, Search, History, X, AlertCircle, Eye,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { formatCLP, formatDate, ESTADOS_COTIZACION, REGIMENES_IVA } from '../../lib/helpers'
import {
  getCotizacionCompleta, getCatalogo, getCotizadorConfig, getHistorialPrecio, registrarHistorialPrecio,
  createCapitulo, updateCapitulo, deleteCapitulo,
  createSubBloque, updateSubBloque, deleteSubBloque,
  createLinea, updateLinea, deleteLinea,
  createPaquete, updatePaquete, deletePaquete,
  addDestinoPaquete, removeDestinoPaquete,
  createHito, updateHito, deleteHito,
} from '../../lib/cotizador/api'
import { calcularCotizacion } from '../../lib/cotizador/calculo'

const LINEA_INICIAL = { partida_id: null, descripcion: '', unidad: '', cantidad: 1, costo_unit_catalogo: null, costo_unit_usado: 0, estado: 'firme' }

export default function CotizadorBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  // ── Cálculo en vivo (motor de la Etapa 4/5/7, una sola fuente de verdad) ──
  const calculado = calcularCotizacion({
    capitulos: cotizacion.capitulo,
    paquetes: cotizacion.paquete_comercial,
    config: { ivaPct: config.iva_pct, ivaObraFactor: config.iva_obra_factor },
  })
  const { todasLasLineas, totalCotizacion, lineasSinPrecio, capitulosSinPaquete } = calculado

  const netoCapitulo = (cap) => {
    const calc = calculado.capitulos.find((c) => c.id === cap.id)
    if (!calc) return 0
    return calc.sub_bloque
      .flatMap((sb) => sb.linea)
      .reduce((acc, l) => acc + l.totalLinea, 0)
  }

  // ── Paquetes comerciales (Etapa 7) ───────────────────────────────
  const todosLosDestinos = cotizacion.paquete_comercial.flatMap((p) => p.paquete_capitulo)
  const calcularPaquete = (paquete) => calculado.paquetes.find((p) => p.id === paquete.id)

  const handleAddPaquete = async (nombre) => {
    const nuevo = await createPaquete({ cotizacion_id: id, orden: cotizacion.paquete_comercial.length, nombre })
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: [...c.paquete_comercial, { ...nuevo, paquete_capitulo: [], hito_pago: [] }],
    }))
    return nuevo
  }

  const handleProponerPorCapitulo = async () => {
    for (const cap of capitulosSinPaquete) {
      const nuevo = await handleAddPaquete(cap.nombre)
      const destino = await addDestinoPaquete({ paqueteId: nuevo.id, capituloId: cap.id })
      setCotizacion((c) => ({
        ...c,
        paquete_comercial: c.paquete_comercial.map((p) => (p.id === nuevo.id ? { ...p, paquete_capitulo: [destino] } : p)),
      }))
    }
  }

  const handleUpdatePaquete = async (paqueteId, updates) => {
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => (p.id === paqueteId ? { ...p, ...updates } : p)),
    }))
    await updatePaquete(paqueteId, updates)
  }

  const handleDeletePaquete = async (paqueteId) => {
    if (!confirm('¿Eliminar este paquete?')) return
    await deletePaquete(paqueteId)
    setCotizacion((c) => ({ ...c, paquete_comercial: c.paquete_comercial.filter((p) => p.id !== paqueteId) }))
  }

  const handleAddDestino = async (paqueteId, destino) => {
    const nuevo = await addDestinoPaquete({ paqueteId, ...destino })
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => (p.id === paqueteId ? { ...p, paquete_capitulo: [...p.paquete_capitulo, nuevo] } : p)),
    }))
  }

  const handleRemoveDestino = async (paqueteId, destinoId) => {
    await removeDestinoPaquete(destinoId)
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => (p.id === paqueteId ? { ...p, paquete_capitulo: p.paquete_capitulo.filter((d) => d.id !== destinoId) } : p)),
    }))
  }

  const handleAddHito = async (paqueteId) => {
    const paquete = cotizacion.paquete_comercial.find((p) => p.id === paqueteId)
    const nuevo = await createHito({ paquete_id: paqueteId, orden: paquete.hito_pago.length, glosa: `Cuota ${paquete.hito_pago.length + 1}`, porcentaje: 0 })
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => (p.id === paqueteId ? { ...p, hito_pago: [...p.hito_pago, nuevo] } : p)),
    }))
  }

  const handleUpdateHito = async (paqueteId, hitoId, updates) => {
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => p.id !== paqueteId ? p : {
        ...p,
        hito_pago: p.hito_pago.map((h) => (h.id === hitoId ? { ...h, ...updates } : h)),
      }),
    }))
    await updateHito(hitoId, updates)
  }

  const handleDeleteHito = async (paqueteId, hitoId) => {
    await deleteHito(hitoId)
    setCotizacion((c) => ({
      ...c,
      paquete_comercial: c.paquete_comercial.map((p) => (p.id === paqueteId ? { ...p, hito_pago: p.hito_pago.filter((h) => h.id !== hitoId) } : p)),
    }))
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
            <p className="num text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>{formatCLP(totalCotizacion)}</p>
            <button onClick={() => navigate(`/cotizador/${id}/cliente`)} className="btn-secondary text-xs">
              <Eye size={13} /> Ver vista cliente / PDF
            </button>
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

      {/* Paquetes comerciales y plan de pago (Etapa 7) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>Paquetes comerciales y plan de pago</h2>
          {capitulosSinPaquete.length > 0 && (
            <button onClick={handleProponerPorCapitulo} className="btn-ghost text-xs">
              Proponer un paquete por capítulo ({capitulosSinPaquete.length} sueltos)
            </button>
          )}
        </div>

        {capitulosSinPaquete.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,69,96,0.08)', color: 'var(--red)' }}>
            <AlertCircle size={13} />
            Sin paquete asignado: {capitulosSinPaquete.map((c) => c.nombre).join(', ')}
          </div>
        )}

        {cotizacion.paquete_comercial.map((p) => (
          <PaqueteCard
            key={p.id}
            paquete={p}
            calculo={calcularPaquete(p)}
            capitulos={cotizacion.capitulo}
            onUpdate={(updates) => handleUpdatePaquete(p.id, updates)}
            onDelete={() => handleDeletePaquete(p.id)}
            onAddDestino={(destino) => handleAddDestino(p.id, destino)}
            onRemoveDestino={(destinoId) => handleRemoveDestino(p.id, destinoId)}
            onAddHito={() => handleAddHito(p.id)}
            onUpdateHito={(hitoId, updates) => handleUpdateHito(p.id, hitoId, updates)}
            onDeleteHito={(hitoId) => handleDeleteHito(p.id, hitoId)}
            destinosOcupados={todosLosDestinos}
          />
        ))}

        <button onClick={() => handleAddPaquete('Nuevo paquete')} className="btn-secondary text-sm w-full justify-center py-2.5">
          <Plus size={14} /> Agregar paquete
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
                <th className="font-normal px-1 pb-1.5 w-40">Observaciones</th>
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
  const sinPrecio = linea.costo_unit_usado == null

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
          <input
            className="input py-1 text-sm w-full"
            placeholder="Observaciones"
            value={linea.nota_cliente ?? ''}
            onChange={(e) => onUpdateField('nota_cliente', e.target.value)}
          />
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

function nombreDestino(destino, capitulos) {
  if (destino.capitulo_id) {
    return capitulos.find((c) => c.id === destino.capitulo_id)?.nombre ?? '—'
  }
  const cap = capitulos.find((c) => c.sub_bloque.some((sb) => sb.id === destino.sub_bloque_id))
  const sb = cap?.sub_bloque.find((s) => s.id === destino.sub_bloque_id)
  return sb ? `${cap.nombre} · ${sb.nombre}` : '—'
}

function PaqueteCard({
  paquete, calculo, capitulos, onUpdate, onDelete,
  onAddDestino, onRemoveDestino, onAddHito, onUpdateHito, onDeleteHito, destinosOcupados,
}) {
  const { netoPaquete, regimenValido, sumaCuotas, cuotasValidas, resultado } = calculo

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <input className="input flex-1 font-semibold" value={paquete.nombre} onChange={(e) => onUpdate({ nombre: e.target.value })} />
        <p className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(netoPaquete)}</p>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--red)' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Destinos (capítulos / sub-bloques) */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>Capítulos / sub-bloques</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {paquete.paquete_capitulo.map((d) => (
            <span key={d.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {nombreDestino(d, capitulos)}
              <button onClick={() => onRemoveDestino(d.id)} style={{ color: 'var(--subtle)' }}><X size={11} /></button>
            </span>
          ))}
          {paquete.paquete_capitulo.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>Sin capítulos asignados</span>
          )}
        </div>
        <DestinoPicker capitulos={capitulos} destinosOcupados={destinosOcupados} onAdd={onAddDestino} />
        {!regimenValido && (
          <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--red)' }}>
            <AlertCircle size={11} /> Los capítulos de este paquete tienen regímenes de IVA distintos — no se puede calcular.
          </p>
        )}
      </div>

      {/* Hitos de pago */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>Plan de pago</p>
          <span className="text-[11px] num" style={{ color: sumaCuotas === 100 ? 'var(--green)' : 'var(--red)' }}>{sumaCuotas}% de 100%</span>
        </div>
        <div className="space-y-1.5">
          {paquete.hito_pago.map((h) => (
            <div key={h.id} className="flex items-center gap-2">
              <input className="input py-1 text-sm flex-1" value={h.glosa} onChange={(e) => onUpdateHito(h.id, { glosa: e.target.value })} />
              <input
                type="number"
                className="input num py-1 text-sm w-20"
                value={h.porcentaje}
                onChange={(e) => onUpdateHito(h.id, { porcentaje: Number(e.target.value) })}
              />
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>%</span>
              <button onClick={() => onDeleteHito(h.id)} style={{ color: 'var(--red)' }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <button onClick={onAddHito} className="btn-ghost text-xs mt-2"><Plus size={12} /> Agregar cuota</button>
      </div>

      {!cuotasValidas && paquete.hito_pago.length > 0 && (
        <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: 'var(--red)' }}>
          <AlertCircle size={11} /> Las cuotas deben sumar 100% para calcular el IVA.
        </p>
      )}

      {resultado && (
        <div className="mt-3 pt-3 grid grid-cols-3 gap-3 text-right" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Neto</p>
            <p className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(resultado.neto)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>IVA</p>
            <p className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(resultado.iva)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>Total</p>
            <p className="num text-sm font-bold" style={{ color: 'var(--amber)' }}>{formatCLP(resultado.total)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function DestinoPicker({ capitulos, destinosOcupados, onAdd }) {
  const [valor, setValor] = useState('')

  const ocupado = (tipo, id) => destinosOcupados.some((d) => (tipo === 'cap' ? d.capitulo_id === id : d.sub_bloque_id === id))

  const opciones = capitulos.flatMap((cap) => {
    const items = []
    if (!ocupado('cap', cap.id)) items.push({ value: `cap:${cap.id}`, label: cap.nombre })
    cap.sub_bloque.forEach((sb) => {
      if (!ocupado('sb', sb.id)) items.push({ value: `sb:${sb.id}`, label: `${cap.nombre} · ${sb.nombre}` })
    })
    return items
  })

  const agregar = () => {
    if (!valor) return
    const [tipo, id] = valor.split(':')
    onAdd(tipo === 'cap' ? { capituloId: id } : { subBloqueId: id })
    setValor('')
  }

  if (opciones.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <select className="select py-1 text-xs flex-1" value={valor} onChange={(e) => setValor(e.target.value)}>
        <option value="">Elegir capítulo o sub-bloque...</option>
        {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={agregar} disabled={!valor} className="btn-ghost text-xs disabled:opacity-40"><Plus size={12} /></button>
    </div>
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
