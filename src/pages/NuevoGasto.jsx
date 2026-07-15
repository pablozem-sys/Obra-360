import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Upload, CheckCircle2,
  MapPin, Camera, X, Loader2
} from 'lucide-react'
import { getObras, createGasto, uploadDocumento, createDocumento, getProviders, upsertProvider, getActiveBanoByProject, createBanoQuimico, createPagoBano } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CATEGORIAS_GASTO, TIPOS_OBRA, formatCLP } from '../lib/helpers'

const CATS_CDO = Object.entries(CATEGORIAS_GASTO)
  .filter(([k, v]) => !v.auto && !v.legacy && v.grupo === 'Costo Directo de la Obra' && k !== 'mano_obra' && k !== 'subcontratos')
  .map(([k, v]) => ({ value: k, label: v.label, color: v.color }))

const CATS_MOD = Object.entries(CATEGORIAS_GASTO)
  .filter(([k]) => k === 'mano_obra' || k === 'subcontratos')
  .map(([k, v]) => ({ value: k, label: v.label, color: v.color }))

const CATS_GAV = Object.entries(CATEGORIAS_GASTO)
  .filter(([, v]) => !v.auto && !v.legacy && v.grupo === 'Gastos Generales')
  .map(([k, v]) => ({ value: k, label: v.label, color: v.color }))

export default function NuevoGasto() {
  const navigate  = useNavigate()
  const fileRef   = useRef()
  const { user }  = useAuth()
  const [step, setStep]         = useState(1)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [geo, setGeo]           = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [obras, setObras]       = useState([])
  const [obrasLoading, setObrasLoading] = useState(true)
  const [archivoFile, setArchivoFile] = useState(null)
  const [docUploadFailed, setDocUploadFailed] = useState(false)
  const [providers, setProviders]     = useState([])
  const [provSuggestions, setProvSuggestions] = useState([])
  const [showProvDrop, setShowProvDrop] = useState(false)
  const [tipoEgreso, setTipoEgreso] = useState('cdo')

  const [form, setForm] = useState({
    obraId: '', archivo: null, archivoNombre: null,
    monto: '', categoria: 'materiales', proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    medioPago: 'contado', plazoCredito: '', comentario: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const t = setTimeout(() => setObrasLoading(false), 6000)
    getObras()
      .then(setObras)
      .catch(() => setObras([]))
      .finally(() => { clearTimeout(t); setObrasLoading(false) })
    getProviders().then(setProviders).catch(() => {})
  }, [])

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
    if (file) {
      set('archivo', URL.createObjectURL(file))
      set('archivoNombre', file.name)
      setArchivoFile(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setDocUploadFailed(false)
    try {
      let docUrl = null
      if (archivoFile) {
        try {
          const uploadPath = tipoEgreso === 'gav' ? 'gav' : (form.obraId || 'sin-obra')
          const { url } = await uploadDocumento(uploadPath, archivoFile)
          docUrl = url
        } catch (err) {
          console.error('Error al subir documento:', err)
          setDocUploadFailed(true)
        }
      }
      if (form.proveedor.trim()) {
        try { await upsertProvider(form.proveedor.trim()) } catch { /* no bloquea */ }
      }
      const gastoPayload = {
        project_id: (tipoEgreso === 'gav' || !form.obraId) ? null : form.obraId,
        monto: parseInt(form.monto),
        categoria: form.categoria,
        proveedor: form.proveedor,
        fecha: form.fecha,
        medio_pago: form.medioPago,
        plazo_credito: form.medioPago === 'credito' && form.plazoCredito ? parseInt(form.plazoCredito) : null,
        comentario: form.comentario || null,
        documento_url: docUrl,
        lat: geo?.lat ? parseFloat(geo.lat) : null,
        lng: geo?.lng ? parseFloat(geo.lng) : null,
        usuario_id: user?.id || null,
        estado: 'pendiente',
      }
      const nuevoGasto = await createGasto(gastoPayload)

      if (docUrl) {
        try {
          await createDocumento({
            project_id: gastoPayload.project_id,
            tipo: 'comprobante',
            nombre: form.archivoNombre || 'Comprobante de egreso',
            archivo_url: docUrl,
            fecha: form.fecha,
          })
        } catch (err) {
          console.error('Error al registrar documento en Biblioteca:', err)
        }
      }

      if (form.categoria === 'banio_quimico' && tipoEgreso !== 'gav' && form.obraId) {
        try {
          const banoActivo = await getActiveBanoByProject(form.obraId)
          if (banoActivo) {
            await createPagoBano({
              bano_id: banoActivo.id,
              fecha_pago: form.fecha,
              monto: parseInt(form.monto),
              descripcion: 'Pago mensual',
            })
          } else {
            const nuevoBano = await createBanoQuimico({
              project_id: form.obraId,
              fecha_entrada: form.fecha,
              monto_mensual: parseInt(form.monto),
              proveedor: form.proveedor || 'Proveedor',
              estado: 'activo',
              expense_id: nuevoGasto.id,
            })
            await createPagoBano({
              bano_id: nuevoBano.id,
              fecha_pago: form.fecha,
              monto: parseInt(form.monto),
              descripcion: 'Primer abono',
            })
          }
        } catch { /* no bloquea el egreso */ }
      }

      setSaved(true)
    } catch (err) {
      console.error('Error al guardar gasto:', err)
      setSaveError(err?.message || 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setSaved(false); setStep(1); setGeo(null); setArchivoFile(null); setSaveError(''); setDocUploadFailed(false); setTipoEgreso('cdo')
    setForm({ obraId:'', archivo:null, archivoNombre:null, monto:'', categoria:'materiales', proveedor:'', fecha: new Date().toISOString().split('T')[0], medioPago:'contado', plazoCredito:'', comentario:'' })
  }

  const selectedObra = obras.find(o => o.id === form.obraId)
  const [triedStep1, setTriedStep1] = useState(false)
  const [triedStep2, setTriedStep2] = useState(false)
  const canStep1 = tipoEgreso === 'gav' || !!form.obraId
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
          ¡Egreso guardado!
        </h2>
        <p className="text-sm mb-1.5" style={{ color: 'var(--muted)' }}>El egreso fue registrado correctamente.</p>
        {docUploadFailed && (
          <p className="text-[12px] mb-1.5 px-3 py-1.5 rounded-lg" style={{ color: 'var(--red)', background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.25)' }}>
            ⚠ El documento no se pudo adjuntar. Intenta subirlo de nuevo más tarde.
          </p>
        )}
        {geo && (
          <p className="text-[11px] mb-10 flex items-center gap-1.5" style={{ color: 'var(--subtle)' }}>
            <MapPin size={10} />
            {geo.simulado ? 'Ubicación simulada' : `${geo.lat}, ${geo.lng}`}
          </p>
        )}
        <div className="flex gap-3 flex-col sm:flex-row w-full max-w-xs">
          <button onClick={reset} className="btn-primary justify-center flex-1">Subir otro egreso</button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary justify-center flex-1">Dashboard</button>
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
          Subir Egreso
        </h1>
        <p className="text-[12px] mt-1.5" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>
          PASO {step}/3 — {step === 1 ? 'OBRA Y DOCUMENTO' : step === 2 ? 'DATOS DEL EGRESO' : 'CONFIRMAR'}
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
          {/* Tipo de egreso */}
          <div className="card p-5">
            <label className="label mb-2">Tipo de egreso</label>
            <div className="flex flex-col gap-2 mt-1">
              {[
                { value: 'cdo', label: 'Costo Directo',              sub: 'Materiales, equipos, áridos...' },
                { value: 'mod', label: 'Mano de Obra y Subcontratos', sub: 'MOD / Subcontratos de obra' },
                { value: 'gav', label: 'Gasto General',              sub: 'GAV — sin obra asignada' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTipoEgreso(opt.value)
                    set('obraId', '')
                    set('categoria', opt.value === 'gav' ? 'sueldos' : opt.value === 'mod' ? 'mano_obra' : 'materiales')
                  }}
                  className="text-left p-3 rounded-xl transition-all"
                  style={{
                    background: tipoEgreso === opt.value ? 'var(--amber-dim)' : 'var(--bg-surface)',
                    border: `1px solid ${tipoEgreso === opt.value ? 'rgba(255,149,0,0.35)' : 'var(--border)'}`,
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: tipoEgreso === opt.value ? 'var(--amber)' : 'var(--text)' }}>{opt.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'DM Mono' }}>{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {tipoEgreso !== 'gav' && (
          <div className="card p-5">
            <label className="label">Selecciona la obra</label>
            <div className="space-y-2 mt-2">
              {obrasLoading
                ? <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Cargando obras...</p>
                : obras.length === 0
                ? <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>No hay obras activas</p>
                : null}
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
                        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{o.clients?.nombre ?? '—'}</p>
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
          )}

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

          {triedStep1 && !canStep1 && (
            <p style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'DM Mono' }}>⚠ Selecciona una obra o elige Gasto General</p>
          )}
          <button onClick={() => { if (!canStep1) { setTriedStep1(true); return } setStep(2) }} className="btn-primary w-full justify-center">
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
                style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500, borderColor: triedStep2 && !form.monto ? 'var(--red)' : undefined }}
                placeholder="0"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
              />
              {triedStep2 && !form.monto && <p style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'DM Mono', marginTop: 4 }}>⚠ Ingresa el monto</p>}
              {form.monto && (
                <p className="num text-xs mt-1.5 font-medium" style={{ color: 'var(--amber)' }}>
                  {formatCLP(parseInt(form.monto))}
                </p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label className="label">Categoría</label>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 mb-2 px-0.5"
                style={{ color: 'var(--subtle)', fontFamily: 'Unbounded' }}>
                {tipoEgreso === 'gav' ? 'Gastos Generales (GAV)' : tipoEgreso === 'mod' ? 'Mano de Obra y Subcontratos' : 'Costo Directo de la Obra'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(tipoEgreso === 'gav' ? CATS_GAV : tipoEgreso === 'mod' ? CATS_MOD : CATS_CDO).map(c => {
                  const active = form.categoria === c.value
                  return (
                    <button
                      key={c.value}
                      onClick={() => set('categoria', c.value)}
                      className="p-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                        border: `1px solid ${active ? 'var(--border-light)' : 'var(--border)'}`,
                        boxShadow: active ? `0 0 12px rgba(255,149,0,0.08)` : 'none',
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
            <div className="relative">
              <label className="label">Proveedor</label>
              <input
                className="input"
                placeholder="Nombre del proveedor"
                value={form.proveedor}
                autoComplete="off"
                onChange={e => {
                  const v = e.target.value
                  set('proveedor', v)
                  if (v.length >= 1) {
                    const matches = providers.filter(p => p.nombre.toLowerCase().includes(v.toLowerCase())).slice(0, 6)
                    setProvSuggestions(matches)
                    setShowProvDrop(matches.length > 0)
                  } else {
                    setShowProvDrop(false)
                  }
                }}
                onBlur={() => setTimeout(() => setShowProvDrop(false), 150)}
                onFocus={() => {
                  if (form.proveedor.length >= 1 && provSuggestions.length > 0) setShowProvDrop(true)
                }}
                style={{ borderColor: triedStep2 && !form.proveedor ? 'var(--red)' : undefined }}
              />
              {showProvDrop && (
                <div
                  className="absolute left-0 right-0 z-20 rounded-xl overflow-hidden shadow-2xl mt-1"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}
                >
                  {provSuggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => { set('proveedor', p.nombre); setShowProvDrop(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              )}
              {triedStep2 && !form.proveedor && <p style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'DM Mono', marginTop: 4 }}>⚠ Ingresa el proveedor</p>}
            </div>

            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>

            <div>
              <label className="label">Medio de pago</label>
              <div className="flex gap-2 mt-2">
                {[{ value: 'contado', label: 'Al Contado' }, { value: 'credito', label: 'Crédito' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('medioPago', opt.value)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                    style={{
                      background: form.medioPago === opt.value ? 'var(--amber)' : 'var(--bg-surface)',
                      color:      form.medioPago === opt.value ? '#000' : 'var(--muted)',
                      border:     `1px solid ${form.medioPago === opt.value ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.medioPago === 'credito' && (
              <div>
                <label className="label">¿A cuántos meses?</label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 6, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('plazoCredito', String(m))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                      style={{
                        background: form.plazoCredito === String(m) ? 'var(--amber)' : 'var(--bg-surface)',
                        color:      form.plazoCredito === String(m) ? '#000' : 'var(--muted)',
                        border:     `1px solid ${form.plazoCredito === String(m) ? 'transparent' : 'var(--border)'}`,
                      }}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label">Comentario</label>
              <textarea className="input resize-none" rows={3} placeholder="Descripción del egreso..." value={form.comentario} onChange={e => set('comentario', e.target.value)} />
            </div>
          </div>

          <button onClick={() => { if (!canStep2) { setTriedStep2(true); return } setStep(3); getGeo() }} className="btn-primary w-full justify-center">
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
              { label: 'Obra',         value: tipoEgreso === 'gav' ? 'Sin obra (Gasto General)' : selectedObra?.nombre },
              { label: 'Proveedor',    value: form.proveedor },
              { label: 'Categoría',    value: CATEGORIAS_GASTO[form.categoria]?.label },
              { label: 'Fecha',        value: form.fecha },
              { label: 'Medio de pago', value: form.medioPago === 'contado' ? 'Al Contado' : `Crédito${form.plazoCredito ? ` — ${form.plazoCredito} ${form.plazoCredito === '1' ? 'mes' : 'meses'}` : ''}` },
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

          {saveError && (
            <p className="text-[11px] px-1" style={{ color: 'var(--red)', fontFamily: 'DM Mono' }}>
              ⚠ {saveError}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full justify-center disabled:opacity-70"
            style={{ padding: '15px 24px', fontSize: 14 }}
          >
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : <><CheckCircle2 size={16} /> Guardar Egreso</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
