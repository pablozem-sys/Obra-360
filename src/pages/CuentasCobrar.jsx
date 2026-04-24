import { useState } from 'react'
import { Wallet, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { cuentasCobrar as initialCxC, obras } from '../data/mockData'
import { formatCLP, formatDate, ESTADOS_PAGO } from '../lib/helpers'

const FILTROS = ['todos', 'pendiente', 'vencido', 'cobrado']

export default function CuentasCobrar() {
  const [cxc, setCxc] = useState(initialCxC)
  const [filtro, setFiltro] = useState('todos')

  const filtered = filtro === 'todos' ? cxc : cxc.filter(c => c.estado === filtro)

  const totales = {
    pendiente: cxc.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.saldoPendiente, 0),
    vencido:   cxc.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.saldoPendiente, 0),
    cobrado:   cxc.filter(c => c.estado === 'cobrado').reduce((s, c) => s + c.cobrado, 0),
  }

  const marcarCobrado = id => {
    setCxc(prev => prev.map(c => c.id === id ? { ...c, estado: 'cobrado', cobrado: c.montoContrato, saldoPendiente: 0 } : c))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100">Cuentas por Cobrar</h1>
        <p className="text-slate-500 text-sm mt-0.5">Estado de cobros por cliente y obra</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-amber-400" />
            <span className="text-xs text-slate-500 font-medium">Por cobrar</span>
          </div>
          <p className="font-display font-bold text-lg text-amber-400">{formatCLP(totales.pendiente)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxc.filter(c => c.estado === 'pendiente').length} clientes</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-slate-500 font-medium">Vencido</span>
          </div>
          <p className="font-display font-bold text-lg text-red-400">{formatCLP(totales.vencido)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxc.filter(c => c.estado === 'vencido').length} clientes</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-500 font-medium">Cobrado</span>
          </div>
          <p className="font-display font-bold text-lg text-emerald-400">{formatCLP(totales.cobrado)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxc.filter(c => c.estado === 'cobrado').length} clientes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${
              filtro === f ? 'bg-amber-500 text-slate-900' : 'bg-[#1A1E35] text-slate-400 hover:text-slate-200 border border-[#2A2E4A]'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADOS_PAGO[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Cards view (better for CxC) */}
      <div className="space-y-3">
        {filtered.map(c => {
          const obra = obras.find(o => o.id === c.obraId)
          const pctCobrado = c.montoContrato > 0 ? (c.cobrado / c.montoContrato * 100).toFixed(0) : 0

          return (
            <div key={c.id} className={`card p-5 ${c.estado === 'vencido' ? 'border-red-500/30' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={ESTADOS_PAGO[c.estado]?.color}>{ESTADOS_PAGO[c.estado]?.label || c.estado}</Badge>
                    {c.estado === 'vencido' && (
                      <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                        <AlertTriangle size={11} /> Vencido el {formatDate(c.fechaCompromiso)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-100">{c.cliente}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{obra?.nombre}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-500">Saldo pendiente</p>
                  <p className={`font-display font-bold text-xl ${c.saldoPendiente > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatCLP(c.saldoPendiente)}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Cobrado: {formatCLP(c.cobrado)}</span>
                  <span className="text-slate-500">Contrato: {formatCLP(c.montoContrato)}</span>
                </div>
                <div className="h-2 bg-[#131629] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${pctCobrado}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-medium">{pctCobrado}% cobrado</span>
                  <span className="text-slate-500">Compromiso: {formatDate(c.fechaCompromiso)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{c.descripcion}</p>
                {c.estado !== 'cobrado' && (
                  <button
                    onClick={() => marcarCobrado(c.id)}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Marcar cobrado
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Wallet size={28} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin registros para este filtro</p>
          </div>
        )}
      </div>
    </div>
  )
}
