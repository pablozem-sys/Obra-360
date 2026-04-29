import { useState, useEffect } from 'react'
import { Search, FolderOpen, Download, Eye, Loader2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { getDocumentos, getObras } from '../lib/supabase'
import { formatCLP, formatDate, TIPOS_DOC } from '../lib/helpers'

const TIPOS = ['todos', 'factura', 'boleta', 'contrato', 'cotizacion', 'foto', 'permiso', 'comprobante']

export default function Biblioteca() {
  const [docs,       setDocs]       = useState([])
  const [obras,      setObras]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [obraFiltro, setObraFiltro] = useState('all')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getDocumentos().catch(() => []),
      getObras().catch(() => []),
    ]).then(([d, o]) => { setDocs(d); setObras(o) })
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const filtered = docs.filter(d => {
    const matchObra   = obraFiltro === 'all' || d.project_id === obraFiltro
    const matchTipo   = tipoFiltro === 'todos' || d.tipo === tipoFiltro
    const matchSearch = !search || d.nombre?.toLowerCase().includes(search.toLowerCase()) || d.proveedor?.toLowerCase().includes(search.toLowerCase())
    return matchObra && matchTipo && matchSearch
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Biblioteca Documental</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{filtered.length} documentos</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            className="input pl-10"
            placeholder="Buscar documento o proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select className="select flex-1 min-w-[140px] max-w-[200px]" value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
            <option value="all">Todas las obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {TIPOS.map(t => (
              <button
                key={t}
                onClick={() => setTipoFiltro(t)}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150"
                style={{
                  background: tipoFiltro === t ? 'var(--amber)' : 'var(--bg-card)',
                  color: tipoFiltro === t ? '#0A0C1A' : 'var(--muted)',
                  border: `1px solid ${tipoFiltro === t ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {t === 'todos' ? 'Todos' : TIPOS_DOC[t]?.label || t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="font-medium" style={{ color: 'var(--muted)' }}>Sin documentos</p>
          <p className="text-sm mt-1" style={{ color: 'var(--subtle)' }}>Sube gastos con documentos para verlos aquí</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(d => {
            const obra = obras.find(o => o.id === d.project_id)
            const info = TIPOS_DOC[d.tipo]
            return (
              <div key={d.id} className="card-hover p-4 group cursor-pointer">
                <div className="w-full h-24 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                  <span className="text-4xl">{info?.icon ?? '📄'}</span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    {d.archivo_url && (
                      <>
                        <a href={d.archivo_url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <Eye size={14} className="text-white" />
                        </a>
                        <a href={d.archivo_url} download className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <Download size={14} className="text-white" />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{d.nombre}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{obra?.nombre ?? '—'}</p>
                  </div>
                  {info && <Badge className={`text-[10px] ${info.color} bg-transparent border-0`}>{info.label}</Badge>}
                </div>

                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{formatDate(d.fecha)}</span>
                  <span>{d.tamaño ?? ''}</span>
                </div>

                {d.monto && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(d.monto)}</span>
                    {d.proveedor && <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>· {d.proveedor}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
