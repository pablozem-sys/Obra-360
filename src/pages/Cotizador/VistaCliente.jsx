import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Download, Share2, AlertCircle } from 'lucide-react'
import { formatCLP, formatDate } from '../../lib/helpers'
import { getCotizacionCompleta, getCotizadorConfig } from '../../lib/cotizador/api'
import { calcularCotizacion } from '../../lib/cotizador/calculo'
import { generarPdfCliente, descargarPdfCliente } from '../../lib/cotizador/pdf'

export default function VistaCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cotizacion, setCotizacion] = useState(null)
  const [config, setConfig] = useState({ iva_pct: 19, iva_obra_factor: 0.5 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [compartiendo, setCompartiendo] = useState(false)
  const [avisoCompartir, setAvisoCompartir] = useState('')

  useEffect(() => {
    Promise.all([getCotizacionCompleta(id), getCotizadorConfig()])
      .then(([cot, cfg]) => { setCotizacion(cot); setConfig(cfg) })
      .catch((err) => setError(err.message || 'Error al cargar la cotización'))
      .finally(() => setLoading(false))
  }, [id])

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

  const handleDescargar = () => descargarPdfCliente(cotizacion, config)

  // Sin librería de agente: comparte el PDF ya generado vía el share sheet
  // nativo (incluye WhatsApp entre las apps disponibles) si el navegador lo
  // soporta; si no, descarga el PDF y deja instrucciones para adjuntarlo a mano.
  const handleCompartirWhatsapp = async () => {
    setCompartiendo(true)
    setAvisoCompartir('')
    try {
      const doc = generarPdfCliente(cotizacion, config)
      const blob = doc.output('blob')
      const nombreArchivo = `Cotizacion - ${cotizacion.nombre_obra}.pdf`
      const file = new File([blob], nombreArchivo, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombreArchivo, text: `Cotización ${cotizacion.nombre_obra}` })
      } else {
        doc.save(nombreArchivo)
        const mensaje = encodeURIComponent(`Cotización ${cotizacion.nombre_obra} — te la comparto en un momento.`)
        window.open(`https://wa.me/?text=${mensaje}`, '_blank')
        setAvisoCompartir('Tu navegador no permite adjuntar el archivo directo — se descargó el PDF, adjúntalo manualmente en el chat de WhatsApp que se abrió.')
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
          <button onClick={handleDescargar} className="btn-secondary text-sm">
            <Download size={14} /> Descargar PDF
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
