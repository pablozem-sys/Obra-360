import { useState, useEffect } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { getGastos, getObras } from '../lib/supabase'
import { formatCLP, formatDate, CATEGORIAS_GASTO, TIPOS_OBRA } from '../lib/helpers'

export default function Mapa() {
  const [gastos,   setGastos]   = useState([])
  const [obras,    setObras]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [viewMode, setViewMode] = useState('gastos')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([getGastos().catch(() => []), getObras().catch(() => [])])
      .then(([g, o]) => { setGastos(g); setObras(o) })
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const gastosConGeo = gastos.filter(g => g.lat && g.lng)
  const obrasConGeo  = obras.filter(o => o.lat && o.lng)

  const latMin = -33.55, latMax = -33.28
  const lngMin = -70.78, lngMax = -70.44
  const W = 600, H = 380
  const toX = lng => ((lng - lngMin) / (lngMax - lngMin)) * W
  const toY = lat => ((lat - latMax) / (latMin - latMax)) * H

  const points = viewMode === 'gastos'
    ? gastosConGeo.map(g => ({
        id: g.id, x: toX(g.lng), y: toY(g.lat),
        label: g.proveedor, sub: formatCLP(g.monto),
        color: CATEGORIAS_GASTO[g.categoria]?.color || '#64748B', data: g,
      }))
    : obrasConGeo.map(o => ({
        id: o.id, x: toX(o.lng), y: toY(o.lat),
        label: o.nombre, sub: TIPOS_OBRA[o.tipo]?.label,
        color: '#D97706', data: o,
      }))

  const selectedData = selected ? (viewMode === 'gastos'
    ? gastos.find(g => g.id === selected)
    : obras.find(o => o.id === selected)
  ) : null

  const selectedObra = selectedData && viewMode === 'gastos'
    ? obras.find(o => o.id === selectedData.project_id)
    : null

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Mapa de Gastos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Geolocalización de gastos y obras</p>
        </div>
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {[{ key: 'gastos', label: 'Gastos' }, { key: 'obras', label: 'Obras' }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setViewMode(key); setSelected(null) }}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{ background: viewMode === key ? 'var(--amber)' : 'transparent', color: viewMode === key ? '#0A0C1A' : 'var(--muted)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* SVG Map */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <MapPin size={14} style={{ color: 'var(--amber)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Región Metropolitana, Chile</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{points.length} puntos</span>
          </div>
          <div className="relative overflow-hidden" style={{ paddingBottom: '63%', background: 'var(--bg-surface)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" style={{ background: 'linear-gradient(135deg, #0d1017 0%, #131929 100%)' }}>
              {Array.from({ length: 8 }).map((_, i) => <line key={`v${i}`} x1={i*(W/7)} y1={0} x2={i*(W/7)} y2={H} stroke="#1A1E35" strokeWidth={1} />)}
              {Array.from({ length: 6 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i*(H/5)} x2={W} y2={i*(H/5)} stroke="#1A1E35" strokeWidth={1} />)}
              <text x={10} y={18} fill="#2A2E4A" fontSize={10} fontFamily="monospace">Santiago, Chile</text>
              <line x1={0} y1={H*0.5} x2={W} y2={H*0.5} stroke="#1E2440" strokeWidth={2} />
              <line x1={W*0.5} y1={0} x2={W*0.5} y2={H} stroke="#1E2440" strokeWidth={2} />
              {points.map(p => (
                <g key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={selected === p.id ? 14 : 10} fill={p.color} fillOpacity={selected === p.id ? 0.15 : 0.08} stroke={p.color} strokeOpacity={selected === p.id ? 0.5 : 0.2} strokeWidth={selected === p.id ? 1.5 : 1} />
                  <circle cx={p.x} cy={p.y} r={selected === p.id ? 6 : 4} fill={p.color} fillOpacity={selected === p.id ? 1 : 0.85} />
                  {selected === p.id && (
                    <text x={p.x} y={p.y - 16} fill={p.color} fontSize={9} textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                      {p.label?.slice(0, 18)}{(p.label?.length ?? 0) > 18 ? '…' : ''}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          {points.length === 0 && (
            <div className="px-5 py-4 text-center text-sm" style={{ color: 'var(--subtle)' }}>
              Sin puntos geolocalizados aún
            </div>
          )}
          <div className="px-5 py-3 flex flex-wrap gap-4" style={{ borderTop: '1px solid var(--border)' }}>
            {viewMode === 'gastos' && Object.entries(CATEGORIAS_GASTO).filter(([k]) => gastosConGeo.some(g => g.categoria === k)).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />{v.label}
              </div>
            ))}
            {viewMode === 'obras' && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                <span className="w-2 h-2 rounded-full bg-amber-500" />Obras
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-3">
          {selectedData ? (
            <div className="card p-5 space-y-3">
              <h3 className="section-title">{viewMode === 'gastos' ? selectedData.proveedor : selectedData.nombre}</h3>
              {viewMode === 'gastos' ? (
                <>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Obra</p><p className="text-sm" style={{ color: 'var(--text)' }}>{selectedObra?.nombre ?? '—'}</p></div>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Monto</p><p className="text-lg font-display font-bold" style={{ color: 'var(--amber)' }}>{formatCLP(selectedData.monto)}</p></div>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Categoría</p><p className="text-sm" style={{ color: 'var(--text)' }}>{CATEGORIAS_GASTO[selectedData.categoria]?.label}</p></div>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Fecha</p><p className="text-sm" style={{ color: 'var(--text)' }}>{formatDate(selectedData.fecha)}</p></div>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Coordenadas</p><p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{selectedData.lat}, {selectedData.lng}</p></div>
                  {selectedData.comentario && <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Comentario</p><p className="text-xs" style={{ color: 'var(--text)' }}>{selectedData.comentario}</p></div>}
                </>
              ) : (
                <>
                  {selectedData.tipo && <Badge className={TIPOS_OBRA[selectedData.tipo]?.color}>{TIPOS_OBRA[selectedData.tipo]?.label}</Badge>}
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Cliente</p><p className="text-sm" style={{ color: 'var(--text)' }}>{selectedData.clients?.nombre ?? '—'}</p></div>
                  <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Dirección</p><p className="text-sm" style={{ color: 'var(--text)' }}>{selectedData.direccion}</p></div>
                  {selectedData.presupuesto && <div><p className="text-xs" style={{ color: 'var(--muted)' }}>Presupuesto</p><p className="text-lg font-display font-bold" style={{ color: 'var(--amber)' }}>{formatCLP(selectedData.presupuesto)}</p></div>}
                </>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <MapPin size={24} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Toca un punto en el mapa</p>
              <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>para ver el detalle</p>
            </div>
          )}

          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Resumen</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Puntos registrados</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{points.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--muted)' }}>Obras en mapa</span>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{obrasConGeo.length}</span>
              </div>
              {viewMode === 'gastos' && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>Total geolocalizados</span>
                  <span className="font-semibold" style={{ color: 'var(--amber)' }}>{formatCLP(gastosConGeo.reduce((s, g) => s + (g.monto ?? 0), 0))}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
