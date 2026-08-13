import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Download, Share2, AlertCircle, FileCheck, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import { formatCLP, formatDate } from '../../lib/helpers'
import { getCotizacionCompleta, getCotizadorConfig, getVersiones, emitirVersion, marcarVersionAceptada } from '../../lib/cotizador/api'
import { calcularCotizacion, validarEmision, advertenciasEmision, snapshotCotizacion, compararVersiones } from '../../lib/cotizador/calculo'
import { generarPdfCliente } from '../../lib/cotizador/pdf'

const NOMBRES_BLOQUEANTE = {
  lineas_sin_precio: (b) => `${b.cantidad} línea(s) sin precio unitario`,
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
  const [avisoCompartir, setAvisoCompartir] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [confirmarEmision, setConfirmarEmision] = useState(false)
  const [versionExpandida, setVersionExpandida] = useState(null)

  // El PDF real (no una réplica en HTML aparte) — se genera una vez y se
  // reusa tanto para la vista embebida como para descargar/compartir, así
  // no puede haber diferencia entre "lo que se ve" y "lo que se manda".
  const [pdfBlob, setPdfBlob] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfError, setPdfError] = useState('')

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

  useEffect(() => {
    if (!cotizacion) return
    let cancelado = false
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setPdfError('')
    generarPdfCliente(cotizacion, config)
      .then((doc) => {
        if (cancelado) return
        const blob = doc.output('blob')
        setPdfBlob(blob)
        setPdfUrl(URL.createObjectURL(blob))
      })
      .catch((err) => !cancelado && setPdfError(err.message || 'Error al generar el PDF'))
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacion, config])

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

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

  const validacion = validarEmision(cotizacion, calculado)
  const advertencias = advertenciasEmision(calculado, config)

  const nombreArchivo = `Cotizacion - ${cotizacion.nombre_obra}.pdf`

  const handleDescargar = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = nombreArchivo
    a.click()
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
    if (!pdfBlob) return
    setCompartiendo(true)
    setAvisoCompartir('')
    try {
      const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' })

      if (esMovil && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombreArchivo, text: `Cotización ${cotizacion.nombre_obra}` })
      } else {
        handleDescargar()
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
          <button onClick={handleDescargar} disabled={!pdfUrl} className="btn-secondary text-sm disabled:opacity-60">
            {!pdfUrl ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Descargar PDF
          </button>
          <button onClick={handleCompartirWhatsapp} disabled={compartiendo || !pdfBlob} className="btn-primary text-sm disabled:opacity-60">
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
          <AlertCircle size={13} /> Esta cotización tiene {calculado.lineasSinPrecio.length} línea(s) sin precio — el PDF las va a mostrar en $0.
        </div>
      )}

      {/* El documento embebido ES el PDF real (mismo blob que se descarga/comparte) — nunca puede desincronizarse de lo que se manda */}
      <div className="card overflow-hidden" style={{ height: '85vh' }}>
        {pdfError ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <AlertCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--red)' }} />
              <p style={{ color: 'var(--muted)' }}>{pdfError}</p>
            </div>
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} title="Cotización PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
          </div>
        )}
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
