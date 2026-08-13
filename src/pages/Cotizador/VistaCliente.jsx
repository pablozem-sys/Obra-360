import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Download, Share2, AlertCircle, FileCheck, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import { formatCLP, formatDate } from '../../lib/helpers'
import { getCotizacionCompleta, getCotizadorConfig, getVersiones, emitirVersion, marcarVersionAceptada } from '../../lib/cotizador/api'
import { calcularCotizacion, validarEmision, advertenciasEmision, snapshotCotizacion, compararVersiones } from '../../lib/cotizador/calculo'
import { generarPdfCliente, descargarPdfCliente } from '../../lib/cotizador/pdf'

const NOMBRES_BLOQUEANTE = {
  lineas_sin_precio: (b) => `${b.cantidad} línea(s) firme(s) sin precio unitario`,
  capitulos_sin_margen: (b) => `${b.cantidad} capítulo(s) sin margen definido`,
  cuotas_invalidas: (b) => `${b.cantidad} paquete(s) con cuotas que no suman 100%`,
  capitulos_sin_paquete: (b) => `${b.cantidad} capítulo(s) sin paquete asignado`,
  sin_validez: () => 'La cotización no tiene fecha de validez',
}

const NOMBRES_ADVERTENCIA = {
  precio_desviado: (a) => `${a.cantidad} línea(s) con precio alejado del catálogo`,
  nota_interna: (a) => `${a.cantidad} línea(s) con nota interna sin resolver`,
}

export default function VistaCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cotizacion, setCotizacion] = useState(null)
  const [config, setConfig] = useState({ iva_pct: 19, iva_obra_factor: 0.5 })
  const [versiones, setVersiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [compartiendo, setCompartiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [avisoCompartir, setAvisoCompartir] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [confirmarEmision, setConfirmarEmision] = useState(false)
  const [versionExpandida, setVersionExpandida] = useState(null)

  const cargar = useCallback(async () => {
    const [cot, cfg, vers] = await Promise.all([getCotizacionCompleta(id), getCotizadorConfig(), getVersiones(id)])
    setCotizacion(cot)
    setConfig(cfg)
    setVersiones(vers)
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

  const calculado = calcularCotizacion({
    capitulos: cotizacion.capitulo,
    paquetes: cotizacion.paquete_comercial,
    config: { ivaPct: config.iva_pct, ivaObraFactor: config.iva_obra_factor },
  })
  const paquetesValidos = calculado.paquetes.filter((p) => p.resultado)
  const opcionales = calculado.todasLasLineas.filter((l) => l.estado === 'opcional')
  const porDefinir = calculado.todasLasLineas.filter((l) => l.estado === 'por_definir')
  const excluidas = calculado.todasLasLineas.filter((l) => l.estado === 'excluido')

  const validacion = validarEmision(cotizacion, calculado)
  const advertencias = advertenciasEmision(calculado, config)

  const handleDescargar = async () => {
    setDescargando(true)
    try {
      await descargarPdfCliente(cotizacion, config)
    } finally {
      setDescargando(false)
    }
  }

  const handleEmitir = async () => {
    setEmitiendo(true)
    try {
      const numero = (cotizacion.version_actual ?? 0) + 1
      await emitirVersion({
        cotizacionId: id,
        numero,
        autor: user?.id ?? null,
        snapshot: snapshotCotizacion(calculado),
      })
      setConfirmarEmision(false)
      await cargar()
    } catch (err) {
      setError(err.message || 'Error al emitir la cotización')
    } finally {
      setEmitiendo(false)
    }
  }

  const handleMarcarAceptada = async (versionId) => {
    await marcarVersionAceptada(id, versionId)
    await cargar()
  }

  // Sin librería de agente: comparte el PDF ya generado vía el share sheet
  // nativo (incluye WhatsApp entre las apps disponibles) si el navegador lo
  // soporta; si no, descarga el PDF y deja instrucciones para adjuntarlo a mano.
  // WhatsApp Desktop (Mac/Windows) no se registra como destino del panel
  // nativo de compartir del sistema operativo — a diferencia de WhatsApp en
  // iOS/Android, que sí aparece ahí. Por eso el share nativo solo tiene
  // sentido en celular; en computador vamos directo al flujo de WhatsApp Web
  // + adjuntar a mano, que es el único que realmente funciona ahí.
  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  const handleCompartirWhatsapp = async () => {
    setCompartiendo(true)
    setAvisoCompartir('')
    try {
      const doc = await generarPdfCliente(cotizacion, config)
      const blob = doc.output('blob')
      const nombreArchivo = `Cotizacion - ${cotizacion.nombre_obra}.pdf`
      const file = new File([blob], nombreArchivo, { type: 'application/pdf' })

      if (esMovil && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombreArchivo, text: `Cotización ${cotizacion.nombre_obra}` })
      } else {
        doc.save(nombreArchivo)
        window.open('https://web.whatsapp.com/', '_blank')
        setAvisoCompartir('Se descargó el PDF — en WhatsApp Web, abre el chat del cliente y adjúntalo desde ahí (WhatsApp de escritorio no permite recibir el archivo directo desde el navegador).')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setAvisoCompartir('No se pudo compartir el PDF: ' + (err.message || 'error desconocido'))
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate(`/cotizador/${id}`)} className="btn-ghost text-sm">
          <ArrowLeft size={15} /> Volver al armado
        </button>
        <div className="flex gap-2">
          <button onClick={() => setConfirmarEmision(true)} className="btn-secondary text-sm">
            <FileCheck size={14} /> Emitir versión {(cotizacion.version_actual ?? 0) + 1}
          </button>
          <button onClick={handleDescargar} disabled={descargando} className="btn-secondary text-sm disabled:opacity-60">
            {descargando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Descargar PDF
          </button>
          <button onClick={handleCompartirWhatsapp} disabled={compartiendo} className="btn-primary text-sm disabled:opacity-60">
            {compartiendo ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Compartir por WhatsApp
          </button>
        </div>
      </div>

      {avisoCompartir && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
          <AlertCircle size={13} /> {avisoCompartir}
        </div>
      )}

      {calculado.lineasSinPrecio.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,69,96,0.08)', color: 'var(--red)' }}>
          <AlertCircle size={13} /> Esta cotización tiene {calculado.lineasSinPrecio.length} línea(s) firme sin precio — el PDF las va a mostrar en $0.
        </div>
      )}

      {/* Documento — mismo contenido que el PDF, para previsualizar */}
      <div className="card p-8 max-w-3xl mx-auto" style={{ background: '#fff', color: '#111' }}>
        <h1 className="text-2xl font-bold mb-1">Cotización</h1>
        <p className="text-lg mb-4" style={{ color: '#444' }}>{cotizacion.nombre_obra}</p>
        <div className="text-sm mb-6" style={{ color: '#666' }}>
          <p>Cliente: {cotizacion.cliente_nombre}</p>
          {cotizacion.direccion && <p>Dirección: {cotizacion.direccion}</p>}
          <p>Fecha: {formatDate(cotizacion.fecha)}</p>
          <p>{cotizacion.validez_dias ? `Válida ${cotizacion.validez_dias} días desde la fecha de emisión` : 'Sin fecha de validez definida'}</p>
        </div>

        {calculado.capitulos.map((cap) => {
          const lineasFirmes = cap.sub_bloque.flatMap((sb) => sb.linea).filter((l) => l.estado === 'firme')
          if (lineasFirmes.length === 0) return null
          return (
            <div key={cap.id} className="mb-5">
              <h3 className="font-semibold mb-2">{cap.nombre}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left' }}>
                    <th className="font-normal pb-1">Descripción</th>
                    <th className="font-normal pb-1">Unidad</th>
                    <th className="font-normal pb-1 text-right">Cant.</th>
                    <th className="font-normal pb-1 text-right">Precio unit.</th>
                    <th className="font-normal pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasFirmes.map((l) => (
                    <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                      <td className="py-1">
                        {l.descripcion}
                        {l.nota_cliente && <p style={{ color: '#888', fontSize: 11 }}>{l.nota_cliente}</p>}
                      </td>
                      <td className="py-1">{l.unidad}</td>
                      <td className="py-1 text-right">{l.cantidad}</td>
                      <td className="py-1 text-right">{l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—'}</td>
                      <td className="py-1 text-right font-semibold">{formatCLP(l.totalLinea)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        {paquetesValidos.length > 0 && (
          <div className="mb-5">
            <h3 className="font-semibold mb-2">Plan de pago</h3>
            {paquetesValidos.map((p) => (
              <div key={p.id} className="mb-2">
                <p className="text-sm font-semibold">{p.nombre}</p>
                <table className="w-full text-xs">
                  <tbody>
                    {p.resultado.hitos.map((h, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                        <td className="py-1">{h.glosa}</td>
                        <td className="py-1 text-right">{h.porcentaje}%</td>
                        <td className="py-1 text-right font-semibold">{formatCLP(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="text-right font-bold mt-2">
              Total contrato: {formatCLP(paquetesValidos.reduce((acc, p) => acc + p.resultado.total, 0))}
            </p>
          </div>
        )}

        {opcionales.length > 0 && <SeccionSimple titulo="Opcionales" lineas={opcionales} conPrecio />}
        {porDefinir.length > 0 && <SeccionSimple titulo="Alcance por definir" lineas={porDefinir} />}
        {excluidas.length > 0 && <SeccionSimple titulo="No incluye" lineas={excluidas} />}
      </div>

      {/* Historial de versiones (sección 10) */}
      {versiones.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display font-semibold text-base mb-3" style={{ color: 'var(--text)' }}>Historial de versiones</h2>
          <div className="space-y-2">
            {versiones.map((v, i) => {
              const anterior = versiones[i + 1]
              const diff = compararVersiones(anterior?.snapshot, v.snapshot)
              const expandida = versionExpandida === v.id
              const hayCambios = diff.agregadas.length + diff.eliminadas.length + diff.cambiosPrecio.length > 0
              return (
                <div key={v.id} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setVersionExpandida(expandida ? null : v.id)}
                      className="flex items-center gap-2 text-sm flex-1 text-left"
                      style={{ color: 'var(--text)' }}
                    >
                      {expandida ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="font-semibold">v{v.numero}</span>
                      <span style={{ color: 'var(--subtle)' }}>{formatDate(v.fecha_emision?.split('T')[0])}</span>
                      {v.aceptada && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--green)' }}><Check size={12} /> Aceptada</span>
                      )}
                    </button>
                    {!v.aceptada && (
                      <button onClick={() => handleMarcarAceptada(v.id)} className="btn-ghost text-xs">Marcar como aceptada</button>
                    )}
                  </div>
                  {expandida && (
                    <div className="mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
                      {!hayCambios ? (
                        <p>Sin cambios respecto de la versión anterior.</p>
                      ) : (
                        <>
                          {diff.agregadas.length > 0 && <p style={{ color: 'var(--green)' }}>+ {diff.agregadas.length} línea(s) agregada(s)</p>}
                          {diff.eliminadas.length > 0 && <p style={{ color: 'var(--red)' }}>− {diff.eliminadas.length} línea(s) eliminada(s)</p>}
                          {diff.cambiosPrecio.length > 0 && (
                            <div>
                              <p style={{ color: 'var(--amber)' }}>~ {diff.cambiosPrecio.length} línea(s) con cambio de precio:</p>
                              <ul className="ml-3">
                                {diff.cambiosPrecio.map((c, j) => (
                                  <li key={j}>{c.actual.descripcion}: {formatCLP(c.anterior.precioUnitario)} → {formatCLP(c.actual.precioUnitario)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirmación de emisión — validaciones bloqueantes y advertencias (sección 9) */}
      <Modal open={confirmarEmision} onClose={() => setConfirmarEmision(false)} title={`Emitir versión ${(cotizacion.version_actual ?? 0) + 1}`} size="md">
        <div className="space-y-4">
          {validacion.bloqueantes.length > 0 ? (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--red)' }}>No se puede emitir:</p>
              <ul className="text-xs space-y-1" style={{ color: 'var(--red)' }}>
                {validacion.bloqueantes.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {NOMBRES_BLOQUEANTE[b.tipo]?.(b) ?? b.tipo}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Esto congela una copia inmutable de la cotización tal como está ahora (líneas, precios y totales).
              </p>
              {advertencias.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--amber)' }}>Advertencias (no bloquean la emisión):</p>
                  <ul className="text-xs space-y-1" style={{ color: 'var(--amber)' }}>
                    {advertencias.map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {NOMBRES_ADVERTENCIA[a.tipo]?.(a) ?? a.tipo}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <div className="flex gap-3">
            <button onClick={() => setConfirmarEmision(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button
              onClick={handleEmitir}
              disabled={!validacion.puedeEmitir || emitiendo}
              className="btn-primary flex-1 justify-center disabled:opacity-40"
            >
              {emitiendo ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />} Emitir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SeccionSimple({ titulo, lineas, conPrecio }) {
  return (
    <div className="mb-5">
      <h3 className="font-semibold mb-2">{titulo}</h3>
      <ul className="text-xs" style={{ color: '#555' }}>
        {lineas.map((l) => (
          <li key={l.id} className="py-1" style={{ borderTop: '1px solid #eee' }}>
            {l.descripcion} {l.unidad && `· ${l.cantidad} ${l.unidad}`}
            {conPrecio && l.precioUnitario != null && <span className="float-right font-semibold">{formatCLP(l.totalLinea)}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
