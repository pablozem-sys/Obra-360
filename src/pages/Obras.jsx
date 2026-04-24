import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, MapPin, User, ArrowRight, Calendar } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { obras as initialObras, gastos, ingresos } from '../data/mockData'
import {
  formatCLP, formatDate, calcGastosObra, calcIngresosObra,
  TIPOS_OBRA, ESTADOS_OBRA
} from '../lib/helpers'

const FILTROS = [
  { key: 'all',          label: 'Todas' },
  { key: 'en_ejecucion', label: 'En Ejecución' },
  { key: 'cotizada',     label: 'Cotizadas' },
  { key: 'pausada',      label: 'Pausadas' },
  { key: 'finalizada',   label: 'Finalizadas' },
]

const TIPOS = ['piscina', 'quincho', 'ampliacion', 'remodelacion', 'otro']

export default function Obras() {
  const navigate = useNavigate()
  const [obras, setObras] = useState(initialObras)
  const [filtro, setFiltro] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nombre: '', cliente: '', direccion: '', tipo: 'piscina',
    fechaInicio: '', fechaTermino: '', presupuesto: '',
    responsable: '', estado: 'cotizada', descripcion: '',
  })

  const filtered = obras.filter(o => {
    const matchFiltro = filtro === 'all' || o.estado === filtro
    const matchSearch = !search ||
      o.nombre.toLowerCase().includes(search.toLowerCase()) ||
      o.cliente.toLowerCase().includes(search.toLowerCase())
    return matchFiltro && matchSearch
  })

  const handleCreate = () => {
    const newObra = {
      ...form,
      id: String(Date.now()),
      presupuesto: parseInt(form.presupuesto) || 0,
      avance: 0,
      lat: -33.4489,
      lng: -70.6693,
      clienteId: String(Date.now()),
    }
    setObras(prev => [newObra, ...prev])
    setShowForm(false)
    setForm({ nombre: '', cliente: '', direccion: '', tipo: 'piscina', fechaInicio: '', fechaTermino: '', presupuesto: '', responsable: '', estado: 'cotizada', descripcion: '' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Obras</h1>
          <p className="text-slate-500 text-sm mt-0.5">{obras.length} proyectos en total</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Nueva Obra</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                filtro === f.key
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-[#1A1E35] text-slate-400 hover:text-slate-200 border border-[#2A2E4A]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Sin obras para este filtro</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => {
            const gasto = calcGastosObra(gastos, o.id)
            const ingreso = calcIngresosObra(ingresos, o.id)
            const pctGasto = Math.min((gasto / o.presupuesto) * 100, 100)
            const sobrecosto = gasto > o.presupuesto * 0.9
            const estadoInfo = ESTADOS_OBRA[o.estado]
            const tipoInfo = TIPOS_OBRA[o.tipo]

            return (
              <div
                key={o.id}
                onClick={() => navigate(`/obras/${o.id}`)}
                className="card-hover p-5 cursor-pointer group"
              >
                {/* Top badges */}
                <div className="flex items-center justify-between mb-4">
                  <Badge className={tipoInfo?.color}>{tipoInfo?.label}</Badge>
                  <Badge className={estadoInfo?.color}>{estadoInfo?.label}</Badge>
                </div>

                {/* Nombre + cliente */}
                <h3 className="font-display font-semibold text-slate-100 text-base leading-tight mb-1">
                  {o.nombre}
                </h3>
                <p className="text-sm text-slate-400 mb-3">{o.cliente}</p>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                  <MapPin size={11} />
                  <span className="truncate">{o.direccion}</span>
                </div>

                {/* Budget progress */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Presupuesto ejecutado</span>
                    <span className={`font-semibold ${sobrecosto ? 'text-red-400' : 'text-slate-300'}`}>
                      {pctGasto.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#131629] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${sobrecosto ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${pctGasto}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{formatCLP(gasto)}</span>
                    <span>{formatCLP(o.presupuesto)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#2A2E4A]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <User size={11} />
                    {o.responsable}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={11} />
                    {formatDate(o.fechaTermino)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva obra */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva Obra" size="lg">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nombre de la obra *</label>
            <input className="input" placeholder="Ej: Piscina Las Condes" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cliente *</label>
            <input className="input" placeholder="Nombre del cliente" value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} />
          </div>
          <div>
            <label className="label">Responsable</label>
            <input className="input" placeholder="Jefe de obra" value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input className="input" placeholder="Calle y número, comuna" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tipo de obra</label>
            <select className="select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPOS_OBRA[t]?.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado inicial</label>
            <select className="select" value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
              <option value="cotizada">Cotizada</option>
              <option value="en_ejecucion">En ejecución</option>
            </select>
          </div>
          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" className="input" value={form.fechaInicio} onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} />
          </div>
          <div>
            <label className="label">Fecha estimada término</label>
            <input type="date" className="input" value={form.fechaTermino} onChange={e => setForm(p => ({ ...p, fechaTermino: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Presupuesto aprobado (CLP)</label>
            <input type="number" className="input" placeholder="Ej: 25000000" value={form.presupuesto} onChange={e => setForm(p => ({ ...p, presupuesto: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={3} placeholder="Descripción del trabajo..." value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button onClick={handleCreate} disabled={!form.nombre || !form.cliente} className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            Crear Obra
          </button>
        </div>
      </Modal>
    </div>
  )
}
