import { useState } from 'react'
import { MapPin, Building2, DollarSign } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { gastos, obras } from '../data/mockData'
import { formatCLP, formatDate, CATEGORIAS_GASTO, TIPOS_OBRA } from '../lib/helpers'

export default function Mapa() {
  const [selected, setSelected] = useState(null)

  const gastosConGeo = gastos.filter(g => g.lat && g.lng)
  const obrasConGeo = obras.filter(o => o.lat && o.lng)

  const [viewMode, setViewMode] = useState('gastos')

  // Simple SVG map of Santiago (approximate bounds)
  // Lat: -33.28 to -33.55, Lng: -70.44 to -70.78
  const latMin = -33.55, latMax = -33.28
  const lngMin = -70.78, lngMax = -70.44
  const W = 600, H = 380

  const toX = lng => ((lng - lngMin) / (lngMax - lngMin)) * W
  const toY = lat => ((lat - latMax) / (latMin - latMax)) * H

  const points = viewMode === 'gastos'
    ? gastosConGeo.map(g => ({
        id: g.id,
        x: toX(g.lng),
        y: toY(g.lat),
        label: g.proveedor,
        sub: formatCLP(g.monto),
        color: CATEGORIAS_GASTO[g.categoria]?.color || '#64748B',
        data: g,
      }))
    : obrasConGeo.map(o => ({
        id: o.id,
        x: toX(o.lng),
        y: toY(o.lat),
        label: o.nombre,
        sub: TIPOS_OBRA[o.tipo]?.label,
        color: '#D97706',
        data: o,
      }))

  const selectedData = selected ? (viewMode === 'gastos'
    ? gastos.find(g => g.id === selected)
    : obras.find(o => o.id === selected)
  ) : null

  const selectedObra = selectedData && viewMode === 'gastos'
    ? obras.find(o => o.id === selectedData.obraId)
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Mapa de Gastos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Geolocalización de gastos y obras</p>
        </div>
        <div className="flex bg-[#1A1E35] border border-[#2A2E4A] rounded-xl p-1 gap-1">
          {[
            { key: 'gastos', label: 'Gastos' },
            { key: 'obras', label: 'Obras' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setViewMode(key); setSelected(null) }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                viewMode === key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* SVG Map */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-5 py-3 border-b border-[#2A2E4A] flex items-center gap-2">
            <MapPin size={14} className="text-amber-400" />
            <span className="text-sm font-medium text-slate-300">Región Metropolitana, Chile</span>
            <span className="text-xs text-slate-500 ml-auto">{points.length} puntos</span>
          </div>
          <div className="relative bg-[#131629] overflow-hidden" style={{ paddingBottom: '63%' }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 w-full h-full"
              style={{ background: 'linear-gradient(135deg, #0d1017 0%, #131929 100%)' }}
            >
              {/* Grid lines */}
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={`v${i}`} x1={i * (W / 7)} y1={0} x2={i * (W / 7)} y2={H} stroke="#1A1E35" strokeWidth={1} />
              ))}
              {Array.from({ length: 6 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * (H / 5)} x2={W} y2={i * (H / 5)} stroke="#1A1E35" strokeWidth={1} />
              ))}

              {/* Reference text */}
              <text x={10} y={18} fill="#2A2E4A" fontSize={10} fontFamily="monospace">Santiago, Chile</text>

              {/* Roads (simplified) */}
              <line x1={0} y1={H * 0.5} x2={W} y2={H * 0.5} stroke="#1E2440" strokeWidth={2} />
              <line x1={W * 0.5} y1={0} x2={W * 0.5} y2={H} stroke="#1E2440" strokeWidth={2} />
              <line x1={0} y1={H * 0.3} x2={W} y2={H * 0.7} stroke="#1A1E35" strokeWidth={1.5} />

              {/* Points */}
              {points.map(p => (
                <g
                  key={p.id}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Pulse ring */}
                  <circle
                    cx={p.x} cy={p.y}
                    r={selected === p.id ? 14 : 10}
                    fill={p.color}
                    fillOpacity={selected === p.id ? 0.15 : 0.08}
                    stroke={p.color}
                    strokeOpacity={selected === p.id ? 0.5 : 0.2}
                    strokeWidth={selected === p.id ? 1.5 : 1}
                  />
                  <circle
                    cx={p.x} cy={p.y}
                    r={selected === p.id ? 6 : 4}
                    fill={p.color}
                    fillOpacity={selected === p.id ? 1 : 0.85}
                  />
                  {selected === p.id && (
                    <text
                      x={p.x} y={p.y - 16}
                      fill={p.color}
                      fontSize={9}
                      textAnchor="middle"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      fontWeight="600"
                    >
                      {p.label.slice(0, 18)}{p.label.length > 18 ? '…' : ''}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          {/* Legend */}
          <div className="px-5 py-3 flex flex-wrap gap-4 border-t border-[#2A2E4A]">
            {viewMode === 'gastos' && Object.entries(CATEGORIAS_GASTO).filter(([k]) =>
              gastosConGeo.some(g => g.categoria === k)
            ).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                {v.label}
              </div>
            ))}
            {viewMode === 'obras' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Obras
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-3">
          {selectedData ? (
            <div className="card p-5 space-y-3">
              <h3 className="section-title">
                {viewMode === 'gastos' ? selectedData.proveedor : selectedData.nombre}
              </h3>
              {viewMode === 'gastos' ? (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Obra</p>
                    <p className="text-sm text-slate-200">{selectedObra?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Monto</p>
                    <p className="text-lg font-display font-bold text-amber-400">{formatCLP(selectedData.monto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Categoría</p>
                    <p className="text-sm text-slate-200">{CATEGORIAS_GASTO[selectedData.categoria]?.label}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fecha</p>
                    <p className="text-sm text-slate-200">{formatDate(selectedData.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Registrado por</p>
                    <p className="text-sm text-slate-200">{selectedData.usuario}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Coordenadas</p>
                    <p className="text-xs font-mono text-slate-400">{selectedData.lat}, {selectedData.lng}</p>
                  </div>
                  {selectedData.comentario && (
                    <div>
                      <p className="text-xs text-slate-500">Comentario</p>
                      <p className="text-xs text-slate-300">{selectedData.comentario}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Badge className={TIPOS_OBRA[selectedData.tipo]?.color}>{TIPOS_OBRA[selectedData.tipo]?.label}</Badge>
                  <div>
                    <p className="text-xs text-slate-500">Cliente</p>
                    <p className="text-sm text-slate-200">{selectedData.cliente}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Dirección</p>
                    <p className="text-sm text-slate-200">{selectedData.direccion}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Presupuesto</p>
                    <p className="text-lg font-display font-bold text-amber-400">{formatCLP(selectedData.presupuesto)}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <MapPin size={24} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Toca un punto en el mapa</p>
              <p className="text-xs text-slate-500 mt-1">para ver el detalle</p>
            </div>
          )}

          {/* Summary stats */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resumen</p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Puntos registrados</span>
                <span className="text-slate-200 font-semibold">{points.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Obras en mapa</span>
                <span className="text-slate-200 font-semibold">{obrasConGeo.length}</span>
              </div>
              {viewMode === 'gastos' && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total geolocalizados</span>
                  <span className="text-amber-400 font-semibold">
                    {formatCLP(gastosConGeo.reduce((s, g) => s + g.monto, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
