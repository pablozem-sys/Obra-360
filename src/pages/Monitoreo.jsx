import { useState, useEffect } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Users, Building2 } from 'lucide-react'
import { getResumenErrores, getOcurrenciasError, getConteoErrores, MONITOREO_LAST_SEEN_KEY } from '../lib/supabase'

const ORIGENES = ['todos', 'ui', 'data', 'auth', 'storage', 'unhandled', 'promise']

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function isoHaceHoras(horas) {
  return new Date(Date.now() - horas * 3600000).toISOString()
}

function Ocurrencias({ fingerprint }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    getOcurrenciasError(fingerprint, 10).then(setItems).catch(() => setItems([]))
  }, [fingerprint])

  if (items === null) {
    return <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--muted)' }} /></div>
  }
  if (items.length === 0) {
    return <p className="text-xs py-3" style={{ color: 'var(--subtle)' }}>Sin ocurrencias.</p>
  }

  return (
    <div className="space-y-2 pt-2">
      {items.map(o => (
        <div key={o.id} className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="num font-medium" style={{ color: 'var(--text)' }}>{formatFecha(o.created_at)}</span>
            <span style={{ color: o.online === false ? 'var(--red)' : 'var(--subtle)' }}>
              {o.online === false ? 'offline' : 'online'}
            </span>
          </div>
          <p className="mb-1" style={{ color: 'var(--muted)' }}>
            <span style={{ color: 'var(--subtle)' }}>Ruta:</span> {o.ruta || '—'}
            {'  ·  '}
            <span style={{ color: 'var(--subtle)' }}>Rol:</span> {o.rol || '—'}
            {'  ·  '}
            <span style={{ color: 'var(--subtle)' }}>Empresa:</span> {o.empresa_id ? o.empresa_id.slice(0, 8) : '—'}
          </p>
          {o.stack && (
            <pre
              className="mt-1.5 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap break-words"
              style={{ background: 'var(--bg-base)', color: 'var(--subtle)', fontFamily: 'DM Mono', fontSize: 10 }}
            >
              {o.stack}
            </pre>
          )}
          <p className="mt-1.5 truncate" style={{ color: 'var(--subtle)', fontSize: 10 }}>{o.user_agent || ''}</p>
        </div>
      ))}
    </div>
  )
}

export default function Monitoreo() {
  const [loading, setLoading] = useState(true)
  const [grupos, setGrupos] = useState([])
  const [conteo24h, setConteo24h] = useState(null)
  const [conteo7d, setConteo7d] = useState(null)
  const [origenFiltro, setOrigenFiltro] = useState('todos')
  const [rangoDias, setRangoDias] = useState(7)
  const [expandido, setExpandido] = useState(null)

  // Marca "visto ahora" para que el badge del sidebar se limpie — los
  // errores que ya pasaron a estar visibles acá dejan de contar como nuevos.
  useEffect(() => {
    try { localStorage.setItem(MONITOREO_LAST_SEEN_KEY, new Date().toISOString()) } catch { /* ignorar */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    const desde = isoHaceHoras(rangoDias * 24)
    Promise.all([
      getResumenErrores({ origen: origenFiltro === 'todos' ? null : origenFiltro, desde }),
      getConteoErrores(isoHaceHoras(24)),
      getConteoErrores(isoHaceHoras(24 * 7)),
    ]).then(([res, c24, c7]) => {
      setGrupos(res)
      setConteo24h(c24)
      setConteo7d(c7)
    }).catch(() => {
      setGrupos([])
      setConteo24h(0)
      setConteo7d(0)
    }).finally(() => setLoading(false))
  }, [origenFiltro, rangoDias])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Monitoreo</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Errores de la app, agrupados por tipo</p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="num font-bold text-2xl" style={{ color: 'var(--text)' }}>{conteo24h ?? '—'}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Últimas 24h</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="num font-bold text-2xl" style={{ color: 'var(--text)' }}>{conteo7d ?? '—'}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Últimos 7 días</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {ORIGENES.map(o => (
          <button
            key={o}
            onClick={() => setOrigenFiltro(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: origenFiltro === o ? 'var(--amber)' : 'var(--bg-surface)',
              color: origenFiltro === o ? '#000' : 'var(--muted)',
              border: `1px solid ${origenFiltro === o ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {o}
          </button>
        ))}
        <select
          className="select ml-auto text-xs"
          value={rangoDias}
          onChange={e => setRangoDias(Number(e.target.value))}
          style={{ width: 'auto' }}
        >
          <option value={1}>Último día</option>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <AlertTriangle size={22} style={{ color: 'var(--subtle)', margin: '0 auto 10px' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin errores en el período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map(g => (
            <div key={g.fingerprint} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <button
                className="w-full text-left p-4 flex items-start justify-between gap-3"
                onClick={() => setExpandido(prev => prev === g.fingerprint ? null : g.fingerprint)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="badge" style={{ background: 'rgba(255,69,96,0.12)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.25)' }}>
                      {g.origen}
                    </span>
                    {g.operacion && (
                      <span className="text-[11px] num" style={{ color: 'var(--muted)' }}>{g.operacion}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{g.mensaje}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--subtle)' }}>
                    <span className="num">{g.total} {g.total === 1 ? 'vez' : 'veces'}</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {g.usuarios_distintos}</span>
                    <span className="flex items-center gap-1"><Building2 size={11} /> {g.empresas_distintas}</span>
                    <span>última: {formatFecha(g.ultima_vez)}</span>
                  </div>
                </div>
                {expandido === g.fingerprint
                  ? <ChevronUp size={16} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
                  : <ChevronDown size={16} style={{ color: 'var(--subtle)', flexShrink: 0 }} />}
              </button>
              {expandido === g.fingerprint && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <Ocurrencias fingerprint={g.fingerprint} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
