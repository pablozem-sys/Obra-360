import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BRAND_NAME } from '../lib/helpers'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady]     = useState(false)
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  useEffect(() => {
    // detectSessionInUrl:true ya intercambia el code automáticamente.
    // Escuchamos el evento y también verificamos si la sesión ya existe.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    // Por si el intercambio ocurrió antes de montar el componente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    if (pass.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (pass !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (error) return setError('No se pudo actualizar. Solicita un nuevo enlace.')
    setDone(true)
    setTimeout(() => navigate('/login'), 2500)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 relative"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="blueprint-grid absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">

        <div className="mb-8">
          <h1 style={{
            fontFamily: 'Unbounded, sans-serif',
            fontWeight: 900,
            fontSize: 36,
            letterSpacing: '-0.05em',
            color: 'var(--amber)',
            lineHeight: 1,
            marginBottom: 10,
          }}>
            {BRAND_NAME}
          </h1>
          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>
            // nueva contraseña
          </p>
        </div>

        {done ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 24,
            textAlign: 'center',
          }}>
            <CheckCircle size={32} style={{ color: 'var(--green)', margin: '0 auto 12px' }} />
            <p style={{ fontFamily: 'Instrument Sans', fontSize: 14, color: 'var(--text)' }}>
              ¡Contraseña actualizada!
            </p>
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Redirigiendo al login...
            </p>
          </div>

        ) : !ready ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 24,
          }}>
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Verificando enlace...
            </p>
          </div>

        ) : (
          <>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
            }}>
              <div className="mb-4">
                <label className="label">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    className="input pr-12"
                    style={{ fontFamily: 'DM Mono, monospace', letterSpacing: pass ? '0.18em' : 'normal', fontSize: 14 }}
                    placeholder="••••••"
                    value={pass}
                    onChange={e => { setPass(e.target.value); setError('') }}
                  />
                  <button
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirmar contraseña</label>
                <input
                  type={show ? 'text' : 'password'}
                  className="input"
                  style={{ fontFamily: 'DM Mono, monospace', letterSpacing: confirm ? '0.18em' : 'normal', fontSize: 14 }}
                  placeholder="••••••"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                />
              </div>
            </div>

            {error && (
              <p style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--red)',
                marginBottom: 10,
                paddingLeft: 2,
              }}>
                ⚠ {error}
              </p>
            )}

            <button
              onClick={handleReset}
              disabled={!pass || !confirm || loading}
              className="btn-primary w-full justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ padding: '14px', fontSize: 12, letterSpacing: '0.04em' }}
            >
              {loading
                ? <span style={{ fontFamily: 'DM Mono', letterSpacing: '0.1em' }}>ACTUALIZANDO...</span>
                : <><span>Actualizar contraseña</span> <ArrowRight size={14} /></>
              }
            </button>
          </>
        )}
      </div>
    </div>
  )
}
