import { formatDate, diasHabilesRestantes } from '../../lib/helpers'

// Inicio / Término / días hábiles restantes de una obra — mismo formato en
// las cards de Obras.jsx y en el header de DetalleObra.jsx.
export default function FechasObra({ obra }) {
  if (!obra.fecha_inicio && !obra.fecha_termino) return null
  const diasRestantes = diasHabilesRestantes(obra)

  return (
    <p className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>
      {obra.fecha_inicio && <>Inicio {formatDate(obra.fecha_inicio)}</>}
      {obra.fecha_inicio && obra.fecha_termino && ' · '}
      {obra.fecha_termino && <>Término {formatDate(obra.fecha_termino)}</>}
      {diasRestantes !== null && (
        <>
          {' · '}
          <span style={{
            fontWeight: 600,
            color: diasRestantes === 0 ? 'var(--red)' : diasRestantes <= 5 ? 'var(--amber)' : 'var(--text)',
          }}>
            {diasRestantes === 0 ? 'Atrasada' : `${diasRestantes} días hábiles restantes`}
          </span>
        </>
      )}
    </p>
  )
}
