import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const MAX_W = { sm: 480, md: 560, lg: 768, xl: 1024 }

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    /* Backdrop + scroll container */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Inner: centra verticalmente cuando hay espacio, si no scrollea */}
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Panel */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: MAX_W[size],
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <h3 style={{
              fontFamily: 'Unbounded', fontWeight: 700, fontSize: 14,
              color: 'var(--text)', letterSpacing: '-0.02em', margin: 0,
            }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--muted)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem' }}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
