import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Upload, CheckCircle2,
  MapPin, Camera, X, Loader2
} from 'lucide-react'
import { obras } from '../data/mockData'
import { CATEGORIAS_GASTO, TIPOS_OBRA, formatCLP } from '../lib/helpers'

const CATEGORIAS  = Object.entries(CATEGORIAS_GASTO).map(([k, v]) => ({ value: k, label: v.label, color: v.color }))
const MEDIOS_PAGO = ['transferencia', 'efectivo', 'tarjeta', 'cheque']

export default function NuevoGasto() {
  const navigate  = useNavigate()
  const fileRef   = useRef()
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [geo, setGeo]       = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const [form, setForm] = useState({
    obraId: '', archivo: null, archivoNombre: null,
    monto: '', categoria: 'materiales', proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    medioPago: 'transferencia', comentario: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const getGeo = () => {
    setGeoLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }); setGeoLoading(false) },
      ()  => { setGeo({ lat: -33.4489, lng: -70.6693, simulado: true }); setGeoLoading(false) },
      { timeout: 5000 }
    )
  }

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (file) { set('archivo', URL.createObjectURL(file)); set('archivoNombre', file.name) }
  }

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => { setSaving(false); setSaved(true) }, 1200)
  }

  const reset = () => {
    setSaved(false); setStep(1); setGeo(null)
    setForm({ obraId:'', archivo:null, archivoNombre:null, monto:'', categoria:'materiales', proveedor:'', fecha: new Date().toISOString().split('T')[0], medioPago:'transferencia', comentario:'' })
  }

  const selectedObra = obras.find(o => o.id === form.obraId)
  const canStep1 = !!form.obraId
  const canStep2 = !!form.monto && !!form.proveedor

  /* ── Success screen ─────────────────────────── */
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: 'var(--green-dim)', border: '1px solid rgba(0,196,140,0.3)', boxShadow: '0 0 40px var(--green-dim)' }}
        >
          <CheckCircle2 size={44} style={{ color: 'var(--green)' }} />
        </div>
        <h2 className="font-display font-bold text-2xl mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
          ¡Gasto guardado!
        </h2>
        <p className="text-sm mb-1.5" style={{ color: 'var(--muted)' }}>El gasto fue registrado correctamente.</p>
        {geo && (
          <p className="text-[11px] mb-10 flex items-center gap-1.5" style={{ color: 'var(--subtle)' }}>
            <MapPin size={10} />
            {geo.simulado ? 'Ubicación simulada' : `${geo.lat}, ${geo.lng}`}
          </p>
        )}
        <div className="flex gap-3 flex-col sm:flex-row w-full max-w-xs">
          <button onClick={reset} className="btn-primary justify-center flex-1">Subir otro gasto</button>
          <button onClick={() => navigate('/')} className="btn-secondary justify-center flex-1">Dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}
          className="btn-ghost -ml-1 mb-4 text-sm"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={14} /> {step > 1 ? 'Atrás' : 'Volver'}
        </button>
        <h1 className="font-display font-bold text-[26px] leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
          Subir Gasto
        </h1>
        <p className="text-[12px] mt-1.5" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
          PASO {step}/3 — {step === 1 ? 'OBRA Y DOCUMENTO' : step === 2 ? 'DATOS DEL GASTO' : 'CONFIRMAR'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className="flex-1 h-[3px] rounded-full transition-all duration-400"
            style={{
              background: s <= step ? 'var(--amber)' : 'var(--border)',
              boxShadow: s <= step ? '0 0 8px var(--amber-glow)' : 'none',
            }}
          />
        ))}
      </div>

      {/* ── Step 1: Obra + documento ─────────────── */}
      {step === 1 && (
        <div className="space-y-4 page-enter">
          <div className="card p-5">
            <label className="label">Selecciona la obra</label>
            <div className="space-y-2 mt-2">
              {obras.filter(o => o.estado !== 'finalizada' && o.estado !== 'cotizada').map(o => {
                const active = form.obraId === o.id
                return (
                  <button
                    key={o.id}
                    onClick={() => set('obraId', o.id)}
                    className="w-full text-left p-4 rounded-xl transition-all duration-150"
                    style={{
                      background: active ? 'var(--amber-dim)' : 'var(--bg-surface)',
                      border: `1px solid ${active ? 'rgba(255,149,0,0.35)' : 'var(--border)'}`,
                      boxShadow: active ? '0 0 16px var(--amber-dim)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ background: 'var(--bg-elevated)' }}
                      >
                        {o.tipo === 'piscina' ? '🏊' : o.tipo === 'quincho' ? '🔥' : o.tipo === 'ampliacion' ? '🏗️' : '🔨'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: active ? 'var(--amber)' : 'var(--text)' }}>
                          {o.nombre}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{o.cliente}</p>
                      </div>
                      {active && (
                        <CheckCircle2 size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <label className="label">Documento (opcional)</label>
            <input type="file" ref={fileRef} onChange={handleFile} accept="image/*,.pdf" className="hidden" capture="environment" />
            {form.archivo ? (
              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: 'var(--amber-dim)' }}>📎</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{form.archivoNombre}</p>
                  <p className="text-[11px]" style={{ color: 'var(--green)' }}>Listo para subir</p>
                </div>
                <button onClick={() => { set('archivo', null); set('archivoNombre', null) }}
                  style={{ color: 'var(--muted)' }} className="hover:text-red transition-colors">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed var(--border)', background: 'var(--bg-surface)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,149,0,0.3)'; e.currentTarget.style.background = 'var(--amber-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                <Upload size={24} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Subir factura, boleta o foto</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>PDF, JPG, PNG · toca para elegir</p>
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} className="btn-secondary w-full justify-center mt-3 text-sm">
              <Camera size={14} /> Tomar foto
            </button>
          </div>

          <button onClick={() => setStep(2)} disabled={!canStep1} className="btn-primary w-full justify-center disabled:opacity-30 disabled:cursor-not-allowed">
            Continuar <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* ── Step 2: Datos ────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4 page-enter">
          <div className="card p-5 space-y-5">
            {/* Monto */}
            <div>
              <label className="label">Monto (CLP)</label>
              <input
                type="number"
                className="input num text-2xl"
                style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500 }}
                placeholder="0"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
              />
              {form.monto && (
                <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--amber)' }}>
                  {formatCLP(parseInt(form.monto))}
                </p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label className="label">Categoría</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS.map(c => {
                  const active = form.categoria === c.value
                  return (
                    <button
                      key={c.value}
                      onClick={() => set('categoria', c.value)}
                      className="p-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                        border: `1px solid ${active ? 'var(--border-light)' : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: c.color, boxShadow: active ? `0 0 8px ${c.color}` : 'none' }}
                        />
                        <span className="text-[12px] font-medium" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>
                          {c.label}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Proveedor */}
            <div>
              <label className="label">Proveedor</label>
              <input className="input" placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              </div>
              <div>
                <label className="label">Medio de pago</label>
                <select className="select" value={form.medioPago} onChange={e => set('medioPago', e.target.value)}>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Comentario</label>
              <textarea className="input resize-none" rows={3} placeholder="Descripción del gasto..." value={form.comentario} onChange={e => set('comentario', e.target.value)} />
            </div>
          </div>

          <button onClick={() => { setStep(3); getGeo() }} disabled={!canStep2} className="btn-primary w-full justify-center disabled:opacity-30 disabled:cursor-not-allowed">
            Revisar y confirmar <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* ── Step 3: Confirmar ────────────────────── */}
      {step === 3 && (
        <div className="space-y-4 page-enter">
          <div className="card p-5 space-y-3">
            <h3 className="section-title mb-3">Resumen</h3>

            {[
              { label: 'Obra',         value: selectedObra?.nombre },
              { label: 'Proveedor',    value: form.proveedor },
              { label: 'Categoría',    value: CATEGORIAS_GASTO[form.categoria]?.label },
              { label: 'Fecha',        value: form.fecha },
              { label: 'Medio de pago',value: form.medioPago },
              { label: 'Comentario',   value: form.comentario || '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-start py-2.5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="text-[13px] font-medium text-right max-w-[55%]" style={{ color: 'var(--text)' }}>{value}</span>
              </div>
            ))}

            {/* Monto destacado */}
            <div
              className="rounded-2xl p-5 mt-2"
              style={{ background: 'var(--amber-dim)', border: '1px solid rgba(255,149,0,0.25)', boxShadow: '0 0 32px var(--amber-dim)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--amber)', fontFamily: 'Unbounded', opacity: 0.7 }}>
                Monto total
              </p>
              <p className="num font-medium text-4xl leading-none" style={{ color: 'var(--amber)', letterSpacing: '-0.03em' }}>
                {formatCLP(parseInt(form.monto))}
              </p>
            </div>

            {/* Geo */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: geo ? 'var(--green-dim)' : 'var(--bg-surface)',
                border: `1px solid ${geo ? 'rgba(0,196,140,0.25)' : 'var(--border)'}`,
              }}
            >
              {geoLoading
                ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber)' }} />
                : <MapPin size={14} style={{ color: geo ? 'var(--green)' : 'var(--muted)' }} />
              }
              <div>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>
                  {geoLoading ? 'Obteniendo ubicación...' : geo ? 'Ubicación guardada' : 'Sin ubicación'}
                </p>
                {geo && !geoLoading && (
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{geo.simulado ? 'Coordenadas simuladas' : `${geo.lat}, ${geo.lng}`}</p>
                )}
              </div>
            </div>

            {form.archivoNombre && (
              <div
                className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'var(--blue-dim)', border: '1px solid rgba(67,97,238,0.2)' }}
              >
                <span className="text-sm">📎</span>
                <span className="text-[12px] truncate" style={{ color: 'var(--text)' }}>{form.archivoNombre}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full justify-center disabled:opacity-70"
            style={{ padding: '15px 24px', fontSize: 14 }}
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : <><CheckCircle2 size={16} /> Guardar Gasto</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
