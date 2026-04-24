import { useState } from 'react'
import { Search, FolderOpen, Download, Eye } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { documentos, obras } from '../data/mockData'
import { formatCLP, formatDate, TIPOS_DOC } from '../lib/helpers'

const TIPOS = ['todos', 'factura', 'boleta', 'contrato', 'cotizacion', 'foto', 'permiso', 'comprobante']

export default function Biblioteca() {
  const [obraFiltro, setObraFiltro] = useState('all')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const filtered = documentos.filter(d => {
    const matchObra = obraFiltro === 'all' || d.obraId === obraFiltro
    const matchTipo = tipoFiltro === 'todos' || d.tipo === tipoFiltro
    const matchSearch = !search || d.nombre.toLowerCase().includes(search.toLowerCase()) || d.proveedor?.toLowerCase().includes(search.toLowerCase())
    return matchObra && matchTipo && matchSearch
  })

  const totalDocs = filtered.length
  const totalSize = '14.2 MB'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100">Biblioteca Documental</h1>
        <p className="text-slate-500 text-sm mt-0.5">{totalDocs} documentos · {totalSize}</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
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
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${
                  tipoFiltro === t ? 'bg-amber-500 text-slate-900' : 'bg-[#1A1E35] text-slate-400 hover:text-slate-200 border border-[#2A2E4A]'
                }`}
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
          <FolderOpen size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Sin documentos</p>
          <p className="text-slate-500 text-sm mt-1">Sube gastos con documentos para verlos aquí</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(d => {
            const obra = obras.find(o => o.id === d.obraId)
            const info = TIPOS_DOC[d.tipo]
            const isImage = d.archivo?.match(/\.(jpg|jpeg|png|webp)/i)
            const isPdf = d.archivo?.match(/\.pdf/i)

            return (
              <div key={d.id} className="card-hover p-4 group cursor-pointer">
                {/* Icon/Preview area */}
                <div className="w-full h-24 bg-[#131629] rounded-xl flex items-center justify-center mb-3 relative overflow-hidden">
                  <span className="text-4xl">{info?.icon}</span>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <button className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
                      <Eye size={14} className="text-white" />
                    </button>
                    <button className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
                      <Download size={14} className="text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{d.nombre}</p>
                    <p className="text-xs text-slate-500 truncate">{obra?.nombre}</p>
                  </div>
                  <Badge className={`text-[10px] ${info?.color} bg-transparent border-0`}>{info?.label}</Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(d.fecha)}</span>
                  <span>{d.tamaño}</span>
                </div>

                {d.monto && (
                  <div className="mt-2 pt-2 border-t border-[#2A2E4A]">
                    <span className="text-xs font-semibold text-slate-300">{formatCLP(d.monto)}</span>
                    {d.proveedor && <span className="text-xs text-slate-500 ml-2">· {d.proveedor}</span>}
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
