import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, Loader2, ExternalLink, AlertCircle, Sparkles } from 'lucide-react'
import { supabase, getSignedDocUrl } from '../lib/supabase'
import { formatCLP, formatDate } from '../lib/helpers'

function obraIdDesdeRuta(pathname) {
  const m = pathname.match(/^\/obras\/([^/]+)/)
  return m ? m[1] : null
}

const TOOL_LABELS = {
  buscar_egresos: 'Egreso',
  buscar_documentos: 'Documento',
  buscar_cuentas_por_pagar: 'Cuenta por pagar',
  buscar_cuentas_por_cobrar: 'Cuenta por cobrar',
  buscar_ventas_adicionales: 'Venta adicional',
}

function ResultCard({ r }) {
  const [abriendo, setAbriendo] = useState(false)
  const label = TOOL_LABELS[r._tool] || ''
  const nombre = r.proveedor || r.nombre || r.descripcion || 'Sin nombre'
  const monto = r.monto ?? r.monto_contrato ?? null
  const fecha = r.fecha || r.fecha_vencimiento || r.fecha_compromiso || r.created_at
  const obra = r.projects?.nombre
  const archivoUrl = r.documento_url || r.archivo_url

  const handleAbrir = async () => {
    setAbriendo(true)
    try {
      const url = await getSignedDocUrl(archivoUrl)
      if (url) window.open(url, '_blank', 'noreferrer')
    } catch (err) {
      console.error('Error al abrir documento:', err)
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}>
          {label}
        </span>
        {monto != null && (
          <span className="num font-bold text-sm" style={{ color: 'var(--text)' }}>{formatCLP(monto)}</span>
        )}
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{nombre}</p>
      <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
        <span className="truncate">{[obra, fecha ? formatDate(fecha) : null].filter(Boolean).join(' · ') || '—'}</span>
        {archivoUrl && (
          <button
            onClick={handleAbrir}
            disabled={abriendo}
            className="flex items-center gap-1 font-semibold flex-shrink-0"
            style={{ color: 'var(--amber)' }}
          >
            {abriendo ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
            Ver
          </button>
        )}
      </div>
    </div>
  )
}

export default function AsistenteChat() {
  const location = useLocation()
  const projectId = obraIdDesdeRuta(location.pathname)

  const [open, setOpen] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes, loading])

  const handleEnviar = async (e) => {
    e.preventDefault()
    const texto = pregunta.trim()
    if (!texto || loading) return

    setMensajes(prev => [...prev, { rol: 'usuario', texto }])
    setPregunta('')
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('asistente-busqueda', {
        body: { pregunta: texto, projectId },
      })
      if (error) throw error
      if (data?.error) {
        setMensajes(prev => [...prev, { rol: 'error', texto: data.error }])
      } else {
        setMensajes(prev => [...prev, {
          rol: 'asistente',
          texto: data?.respuesta || 'No obtuve respuesta.',
          resultados: data?.resultados ?? [],
        }])
      }
    } catch (err) {
      console.error('asistente-busqueda:', err)
      setMensajes(prev => [...prev, { rol: 'error', texto: 'No se pudo conectar con el asistente. Probá de nuevo en un momento.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-50 bottom-20 right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 active:scale-95"
          style={{ background: 'var(--amber)', boxShadow: '0 4px 24px var(--amber-glow), 0 0 0 1px rgba(255,149,0,0.4)' }}
          aria-label="Abrir asistente de búsqueda"
        >
          <Sparkles size={22} color="#000" strokeWidth={2} />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[400px] lg:h-[600px] lg:rounded-2xl lg:overflow-hidden"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-header)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--amber)' }}>
                <Sparkles size={14} color="#000" strokeWidth={2.5} />
              </div>
              <p className="font-display font-bold text-sm" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                Asistente
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="btn-ghost p-1.5" style={{ color: 'var(--muted)' }} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {mensajes.length === 0 && (
              <div className="text-center py-8 px-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Preguntame por egresos, documentos, cuentas por pagar/cobrar o ventas adicionales.
                </p>
                <p className="text-[11px] mt-2" style={{ color: 'var(--subtle)' }}>
                  Ej. "facturas de Sodimac de este mes" o "cuánto gastamos en materiales en agosto"
                </p>
              </div>
            )}

            {mensajes.map((m, i) => {
              if (m.rol === 'usuario') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5" style={{ background: 'var(--amber)' }}>
                      <p className="text-sm" style={{ color: '#000' }}>{m.texto}</p>
                    </div>
                  </div>
                )
              }
              if (m.rol === 'error') {
                return (
                  <div key={i} className="flex items-start gap-2 rounded-xl px-3.5 py-2.5" style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,69,96,0.3)' }}>
                    <AlertCircle size={14} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{m.texto}</p>
                  </div>
                )
              }
              return (
                <div key={i} className="space-y-2">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{m.texto}</p>
                  </div>
                  {m.resultados?.length > 0 && (
                    <div className="space-y-2">
                      {m.resultados.slice(0, 50).map((r, j) => <ResultCard key={j} r={r} />)}
                    </div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="flex items-center gap-2 px-1">
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Buscando...</p>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleEnviar} className="flex items-center gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              className="input flex-1"
              placeholder="Escribí tu pregunta..."
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !pregunta.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--amber)' }}
              aria-label="Enviar"
            >
              <Send size={16} color="#000" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
